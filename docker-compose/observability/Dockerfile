ARG BASE_IMAGE=otel/opentelemetry-collector-contrib:0.163.1
FROM golang:1.25.8-alpine AS probe-build
WORKDIR /src
COPY health-probe.go .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /health-probe health-probe.go && mkdir /data

FROM ${BASE_IMAGE}
ARG DATA_UID=10001
COPY --from=probe-build /health-probe /health-probe
COPY --from=probe-build --chown=${DATA_UID}:${DATA_UID} /data /var/observability
