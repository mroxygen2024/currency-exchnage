import asyncio
import json
from datetime import datetime

from fastapi import WebSocket, WebSocketDisconnect

from app.core.database import get_db_context
from app.core.logging import logger
from app.core.redis import get_redis


class WebSocketManager:
    """Manages active WebSocket connections subscribed to currency updates.

    Supports channel-based subscriptions (e.g., subscribing to "EURUSD" or "USDEGP")
    and handles graceful disconnects and concurrent connection safe broadcasting.
    """

    def __init__(self) -> None:
        self.active_connections: dict[str, set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, channel: str) -> None:
        """Accept connection and subscribe it to a specific currency channel."""
        await websocket.accept()
        if channel not in self.active_connections:
            self.active_connections[channel] = set()
        self.active_connections[channel].add(websocket)
        logger.info(
            "WebSocket client connected",
            channel=channel,
            active_subscribers=len(self.active_connections[channel]),
        )

    def disconnect(self, websocket: WebSocket, channel: str) -> None:
        """Remove connection from subscription channel."""
        if channel in self.active_connections:
            self.active_connections[channel].discard(websocket)
            if not self.active_connections[channel]:
                del self.active_connections[channel]
        logger.info(
            "WebSocket client disconnected",
            channel=channel,
            active_subscribers=len(self.active_connections.get(channel, set())),
        )

    async def broadcast_to_channel(self, channel: str, message: dict) -> None:
        """Broadcast JSON message to all clients subscribed to a channel."""
        if channel not in self.active_connections:
            return

        # Create list copy to prevent mutation exceptions during async loop
        subscribers = list(self.active_connections[channel])
        for ws in subscribers:
            try:
                await ws.send_json(message)
            except Exception as exc:
                logger.warning(
                    "Error sending payload to websocket. Disconnecting.",
                    channel=channel,
                    error=str(exc),
                )
                self.disconnect(ws, channel)


ws_manager = WebSocketManager()


class RatesConnectionManager:
    """Manages active WebSocket connections at /ws/rates.

    Supports dynamic currency pair subscriptions, broadcasting updates,
    and handling clean, graceful disconnects.
    """

    def __init__(self) -> None:
        # Map of connection -> set of uppercase currency pairs (e.g. {"USDEUR"})
        self.active_connections: dict[WebSocket, set[str]] = {}

    async def connect(self, websocket: WebSocket) -> None:
        """Accept the connection and add it to the manager."""
        await websocket.accept()
        self.active_connections[websocket] = set()
        logger.info(
            "WebSocket client connected to /ws/rates",
            client_host=websocket.client.host if websocket.client else "unknown",
            total_connections=len(self.active_connections),
        )

    def disconnect(self, websocket: WebSocket) -> None:
        """Remove a connection and clean up its subscriptions."""
        if websocket in self.active_connections:
            del self.active_connections[websocket]
        logger.info(
            "WebSocket client disconnected from /ws/rates",
            total_connections=len(self.active_connections),
        )

    def subscribe(self, websocket: WebSocket, pairs: list[str]) -> None:
        """Subscribe a connection to a list of currency pairs."""
        if websocket in self.active_connections:
            for pair in pairs:
                pair_upper = pair.upper()
                if len(pair_upper) == 6:
                    self.active_connections[websocket].add(pair_upper)
            logger.info(
                "WebSocket client subscribed to pairs",
                pairs=pairs,
                client_subscriptions=list(self.active_connections[websocket]),
            )

    def unsubscribe(self, websocket: WebSocket, pairs: list[str]) -> None:
        """Unsubscribe a connection from a list of currency pairs."""
        if websocket in self.active_connections:
            for pair in pairs:
                self.active_connections[websocket].discard(pair.upper())
            logger.info(
                "WebSocket client unsubscribed from pairs",
                pairs=pairs,
                client_subscriptions=list(self.active_connections[websocket]),
            )

    def get_subscribed_pairs(self) -> set[str]:
        """Return a set of all currency pairs currently subscribed to by any client."""
        all_pairs = set()
        for pairs in self.active_connections.values():
            all_pairs.update(pairs)
        return all_pairs

    async def broadcast_to_subscribers(self, pair: str, payload: dict) -> None:
        """Broadcast a message to all clients subscribed to a specific pair."""
        pair_upper = pair.upper()
        # Find all websockets subscribed to this pair
        subscribers = [
            ws for ws, pairs in self.active_connections.items() if pair_upper in pairs
        ]
        if not subscribers:
            return

        logger.debug(
            "Broadcasting update to subscribers",
            pair=pair_upper,
            subscriber_count=len(subscribers),
        )
        for ws in subscribers:
            try:
                await ws.send_json(payload)
            except Exception as exc:
                logger.warning(
                    "Error sending payload to websocket on /ws/rates. Disconnecting.",
                    error=str(exc),
                )
                self.disconnect(ws)


rates_ws_manager = RatesConnectionManager()


async def fetch_rate_for_pair(db, redis_client, pair: str) -> dict | None:
    """Fetch rate for a 6-character pair (e.g. USDEUR) and format rate payload.

    Imports services dynamically to avoid circular dependencies.
    """
    if len(pair) != 6:
        return None
    base = pair[:3].upper()
    target = pair[3:].upper()
    try:
        from app.modules.currency import services

        rate_obj = await services.get_rate(db, redis_client, base, target)
        if rate_obj:
            return {
                "event": "rate_update",
                "pair": pair,
                "base": base,
                "target": target,
                "rate": float(rate_obj.rate),
                "timestamp": datetime.utcnow().isoformat() + "Z",
            }
    except Exception as exc:
        logger.error(
            "Failed to fetch rate in websocket loop", pair=pair, error=str(exc)
        )
    return None


async def periodic_rates_pusher() -> None:
    """Background task to push rates for all active subscriptions every 5 seconds."""
    logger.info("Starting /ws/rates periodic rates pusher loop (5 seconds).")
    try:
        while True:
            await asyncio.sleep(5)
            pairs = rates_ws_manager.get_subscribed_pairs()
            if not pairs:
                continue

            try:
                redis_client = await get_redis()
                async with get_db_context() as db:
                    for pair in pairs:
                        payload = await fetch_rate_for_pair(db, redis_client, pair)
                        if payload:
                            await rates_ws_manager.broadcast_to_subscribers(
                                pair, payload
                            )
            except Exception as exc:
                logger.error(
                    "Error in periodic rates pusher background loop",
                    error=str(exc),
                )
    except asyncio.CancelledError:
        logger.info("Periodic rates pusher loop was cancelled.")
    except Exception as exc:
        logger.critical("Periodic rates pusher loop crashed", error=str(exc))


async def ws_rates_endpoint(websocket: WebSocket) -> None:
    """WebSocket endpoint for real-time exchange rate streaming and subscriptions."""
    try:
        await rates_ws_manager.connect(websocket)
    except Exception as exc:
        logger.error(
            "Failed to accept WebSocket connection",
            error=str(exc),
            exc_info=True,
        )
        return

    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
            except json.JSONDecodeError:
                await websocket.send_json(
                    {"event": "error", "message": "Invalid JSON format."}
                )
                continue

            action = message.get("action")
            if not action:
                await websocket.send_json(
                    {"event": "error", "message": "Missing 'action' field."}
                )
                continue

            if action == "subscribe":
                pairs = message.get("pairs", [])
                if isinstance(pairs, str):
                    pairs = [pairs]
                elif not isinstance(pairs, list):
                    await websocket.send_json(
                        {
                            "event": "error",
                            "message": "'pairs' must be a string or a list of strings.",
                        }
                    )
                    continue

                valid_pairs = [
                    p.upper()
                    for p in pairs
                    if isinstance(p, str) and len(p.strip()) == 6
                ]
                if not valid_pairs:
                    await websocket.send_json(
                        {
                            "event": "error",
                            "message": "No valid 6-character currency pairs provided.",
                        }
                    )
                    continue

                rates_ws_manager.subscribe(websocket, valid_pairs)
                await websocket.send_json({"event": "subscribed", "pairs": valid_pairs})

                # Immediately push current rates for the newly subscribed pairs
                try:
                    redis_client = await get_redis()
                    async with get_db_context() as db:
                        for pair in valid_pairs:
                            payload = await fetch_rate_for_pair(db, redis_client, pair)
                            if payload:
                                await websocket.send_json(payload)
                except Exception as exc:
                    logger.error(
                        "Failed to push initial rates upon subscription",
                        pairs=valid_pairs,
                        error=str(exc),
                    )

            elif action == "unsubscribe":
                pairs = message.get("pairs", [])
                if isinstance(pairs, str):
                    pairs = [pairs]
                elif not isinstance(pairs, list):
                    await websocket.send_json(
                        {
                            "event": "error",
                            "message": "'pairs' must be a string or a list of strings.",
                        }
                    )
                    continue

                valid_pairs = [p.upper() for p in pairs if isinstance(p, str)]
                rates_ws_manager.unsubscribe(websocket, valid_pairs)
                await websocket.send_json(
                    {"event": "unsubscribed", "pairs": valid_pairs}
                )

            elif action == "ping":
                await websocket.send_json({"event": "pong"})

            else:
                await websocket.send_json(
                    {
                        "event": "error",
                        "message": f"Unknown action '{action}'.",
                    }
                )

    except WebSocketDisconnect:
        rates_ws_manager.disconnect(websocket)
    except Exception as exc:
        logger.error(
            "Error in ws_rates_endpoint loop",
            error=str(exc),
            exc_info=True,
        )
        rates_ws_manager.disconnect(websocket)
