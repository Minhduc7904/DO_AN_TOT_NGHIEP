import { jest } from '@jest/globals';
import type { LookupAddress, LookupOptions } from 'node:dns';
import {
  createTelemetryLookup,
  telemetryHttpTransportOptions,
} from '../../src/telemetry-http-transport.js';

const lookup = (options: LookupOptions, v4 = ['192.0.2.1'], v6 = ['2001:db8::1']) =>
  new Promise<string | LookupAddress[]>((resolve, reject) => {
    createTelemetryLookup(() => ({ resolve4: async () => v4, resolve6: async () => v6 }))(
      'collector.test',
      options,
      (error, addresses) => (error ? reject(error) : resolve(addresses)),
    );
  });

describe('telemetry HTTP DNS isolation', () => {
  it('honors family, all addresses and IPv6 ordering', async () => {
    await expect(lookup({ family: 4 })).resolves.toBe('192.0.2.1');
    await expect(lookup({ family: 6 })).resolves.toBe('2001:db8::1');
    await expect(lookup({ all: true, order: 'ipv6first' })).resolves.toEqual([
      { address: '2001:db8::1', family: 6 },
      { address: '192.0.2.1', family: 4 },
    ]);
    await expect(lookup({ all: true })).resolves.toHaveLength(2);
  });
  it.each(['127.0.0.1', '::1'])('keeps literal %s without DNS', async (hostname) => {
    const factory = jest.fn(() => {
      throw new Error('DNS factory không được gọi');
    });
    const result = await new Promise((done) =>
      createTelemetryLookup(factory)(hostname, {}, (error, address) => done({ error, address })),
    );
    expect(result).toEqual({ error: null, address: hostname });
    expect(factory).not.toHaveBeenCalled();
  });
  it('keeps localhost working without an external DNS record', async () => {
    const factory = jest.fn(() => {
      throw new Error('Không được gọi DNS');
    });
    const result = await new Promise((done) =>
      createTelemetryLookup(factory)('localhost', { family: 6, all: true }, (error, rows) =>
        done({ error, rows }),
      ),
    );
    expect(result).toEqual({ error: null, rows: [{ address: '::1', family: 6 }] });
    expect(factory).not.toHaveBeenCalled();
  });
  it('accepts an available family when the other has no record', async () => {
    const resolve6 = async () => {
      throw Object.assign(new Error('no AAAA'), { code: 'ENODATA' });
    };
    const result = new Promise((resolve, reject) =>
      createTelemetryLookup(() => ({ resolve4: async () => ['192.0.2.2'], resolve6 }))(
        'collector.test',
        { all: true },
        (error, rows) => (error ? reject(error) : resolve(rows)),
      ),
    );
    await expect(result).resolves.toEqual([{ address: '192.0.2.2', family: 4 }]);
  });
  it.each(['ETIMEOUT', 'ENOTFOUND'])('returns %s once and handles empty records', async (code) => {
    const failure = Object.assign(new Error('DNS failure'), { code });
    const reject = async () => {
      throw failure;
    };
    const callback = jest.fn();
    createTelemetryLookup(() => ({ resolve4: reject, resolve6: reject }))(
      'collector.test',
      {},
      callback,
    );
    await new Promise(setImmediate);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(failure, []);
    await expect(lookup({}, [], [])).rejects.toMatchObject({ code: 'ENOTFOUND' });
  });
  it('bounds exporter timeout, concurrency and sockets', () => {
    expect(telemetryHttpTransportOptions()).toEqual({
      timeoutMillis: 1000,
      concurrencyLimit: 1,
      httpAgentOptions: {
        keepAlive: true,
        maxSockets: 1,
        maxTotalSockets: 1,
        lookup: expect.any(Function),
      },
    });
  });
});
