#!/usr/bin/env bash
# Canonical VPS ports — slot 02 mini-580 (source: scripts/host/vps-registry.conf)
VPS_SLOT=02
WEB_PORT_TEST=3021
WEB_PORT_PROD=3020
OPT_ROOT_DEFAULT=/opt/mini580
REGISTRY_IMAGE_DEFAULT=ghcr.io/mini580-baie-de-somme/mini-580

web_port_for_env() {
  case "${1:-}" in
    test) echo "${WEB_PORT_TEST}" ;;
    prod) echo "${WEB_PORT_PROD}" ;;
    *) echo "Unknown env: ${1}" >&2; return 1 ;;
  esac
}
