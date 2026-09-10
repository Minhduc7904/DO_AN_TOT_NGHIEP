# Shared technical packages

## Trách nhiệm

Chứa technical primitive thực sự được nhiều service dùng, ví dụ OpenTelemetry bootstrap hoặc test utility.

## Quy tắc dependency

- Được phụ thuộc thư viện kỹ thuật cần thiết.
- Không được chứa business entity, business repository base class hoặc source code của service.

## Package hiện có

- [`observability/`](observability/README.md): OpenTelemetry bootstrap, resource identity và HTTP instrumentation dùng chung.
