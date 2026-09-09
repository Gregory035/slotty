#!/usr/bin/env python3
"""Expose the host-local Cloudflare WARP proxy to Slotty containers."""

import asyncio
import os


LISTEN_HOST = os.getenv("RELAY_LISTEN_HOST", "172.17.0.1")
LISTEN_PORT = int(os.getenv("RELAY_LISTEN_PORT", "40000"))
UPSTREAM_HOST = os.getenv("WARP_PROXY_HOST", "127.0.0.1")
UPSTREAM_PORT = int(os.getenv("WARP_PROXY_PORT", "40000"))


async def copy_stream(reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
    try:
        while data := await reader.read(65536):
            writer.write(data)
            await writer.drain()
    except (ConnectionError, OSError):
        pass
    finally:
        if not writer.is_closing():
            writer.close()


async def relay(
    client_reader: asyncio.StreamReader,
    client_writer: asyncio.StreamWriter,
) -> None:
    try:
        upstream_reader, upstream_writer = await asyncio.open_connection(
            UPSTREAM_HOST,
            UPSTREAM_PORT,
        )
    except OSError:
        client_writer.close()
        return

    await asyncio.gather(
        copy_stream(client_reader, upstream_writer),
        copy_stream(upstream_reader, client_writer),
    )


async def main() -> None:
    server = await asyncio.start_server(relay, LISTEN_HOST, LISTEN_PORT)
    async with server:
        await server.serve_forever()


if __name__ == "__main__":
    asyncio.run(main())
