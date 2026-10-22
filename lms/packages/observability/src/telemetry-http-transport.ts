import { Resolver } from 'node:dns/promises';
import type { LookupAddress } from 'node:dns';
import { isIP, type LookupFunction } from 'node:net';

type TelemetryResolver = {
  resolve4(hostname: string): Promise<string[]>;
  resolve6(hostname: string): Promise<string[]>;
};

// DNS của exporter dùng c-ares, tránh chiếm libuv thread pool chung với kết nối DB.
export function createTelemetryLookup(
  createResolver: () => TelemetryResolver = () => new Resolver({ timeout: 750, tries: 1 }),
): LookupFunction {
  return (hostname, options, callback) => {
    const family = options.family === 'IPv4' ? 4 : options.family === 'IPv6' ? 6 : options.family;
    const literalFamily = isIP(hostname);
    const finish = (addresses: LookupAddress[]) => {
      if (options.order === 'ipv6first') addresses.sort((a, b) => b.family - a.family);
      if (options.all) callback(null, addresses);
      else callback(null, addresses[0]!.address, addresses[0]!.family);
    };
    if (literalFamily) {
      queueMicrotask(() => finish([{ address: hostname, family: literalFamily }]));
      return;
    }
    if (hostname.toLowerCase() === 'localhost') {
      const addresses: LookupAddress[] = [];
      if (family !== 6) addresses.push({ address: '127.0.0.1', family: 4 });
      if (family !== 4) addresses.push({ address: '::1', family: 6 });
      queueMicrotask(() => finish(addresses));
      return;
    }
    const resolver = createResolver();
    const queries: Promise<LookupAddress[]>[] = [];
    if (family !== 6)
      queries.push(
        resolver.resolve4(hostname).then((rows) => rows.map((address) => ({ address, family: 4 }))),
      );
    if (family !== 4)
      queries.push(
        resolver.resolve6(hostname).then((rows) => rows.map((address) => ({ address, family: 6 }))),
      );
    void Promise.allSettled(queries).then((results) => {
      const addresses = results.flatMap((result) =>
        result.status === 'fulfilled' ? result.value : [],
      );
      if (addresses.length) finish(addresses);
      else {
        const failure = results.find((result) => result.status === 'rejected');
        callback(
          failure?.status === 'rejected'
            ? (failure.reason as NodeJS.ErrnoException)
            : Object.assign(new Error('Telemetry DNS không có địa chỉ'), { code: 'ENOTFOUND' }),
          [],
        );
      }
    });
  };
}

export function telemetryHttpTransportOptions() {
  return {
    timeoutMillis: 1_000,
    concurrencyLimit: 1,
    httpAgentOptions: {
      keepAlive: true,
      maxSockets: 1,
      maxTotalSockets: 1,
      lookup: createTelemetryLookup(),
    },
  };
}
