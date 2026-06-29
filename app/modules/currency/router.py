from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect, status
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import (
    get_current_user_id,
    get_optional_user_id,
)
from app.core.exceptions import BadRequestException, NotFoundException
from app.core.redis import get_redis
from app.modules.currency import schemas, services
from app.modules.currency.websocket import ws_manager

router = APIRouter(prefix="/currencies", tags=["Currency Exchange"])


@router.get("/convert", response_model=schemas.CurrencyConversionOut)
async def convert_currency(
    from_currency: str = Query(
        ...,
        alias="from",
        min_length=3,
        max_length=3,
        pattern=r"^[a-zA-Z]{3}$",
        description="Source 3-letter currency code (e.g. USD)",
    ),
    to_currency: str = Query(
        ...,
        alias="to",
        min_length=3,
        max_length=3,
        pattern=r"^[a-zA-Z]{3}$",
        description="Target 3-letter currency code (e.g. EUR)",
    ),
    amount: float = Query(..., gt=0, description="Amount to convert"),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
    current_user_id: str | None = Depends(get_optional_user_id),
) -> schemas.CurrencyConversionOut:
    """Perform currency conversion and record the transaction in the history log."""
    user_id = int(current_user_id) if current_user_id else None
    return await services.convert_currency(
        db=db,
        redis=redis,
        from_currency=from_currency,
        to_currency=to_currency,
        amount=amount,
        user_id=user_id,
    )


@router.get("/analytics", response_model=schemas.CurrencyAnalyticsOut)
async def get_currency_analytics(
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
    _current_user_id: str = Depends(get_current_user_id),
) -> schemas.CurrencyAnalyticsOut:
    """Retrieve system-wide currency conversion statistics.

    Validates authenticated user, then queries cached analytics or fallback database.
    """
    return await services.get_analytics(db, redis)


@router.get("/supported", response_model=list[str])
async def list_supported_currencies(
    redis: Redis = Depends(get_redis),
) -> list[str]:
    """Retrieve all supported currency codes from cache/provider."""
    return await services.get_supported_currencies(redis)


@router.get("/symbols", response_model=dict[str, str])
async def get_currency_symbols(
    redis: Redis = Depends(get_redis),
) -> dict[str, str]:
    """Retrieve currency code to symbol name mapping."""
    return await services.get_currency_symbols(redis)


@router.get("/rates", response_model=list[schemas.CurrencyRateOut])
async def list_all_rates(
    db: AsyncSession = Depends(get_db),
) -> list[schemas.CurrencyRateOut]:
    """Retrieve all exchange rates stored in the database."""
    return await services.list_rates(db)


@router.get("/rates/{base}/{target}", response_model=schemas.CurrencyRateOut)
async def get_currency_rate(
    base: str,
    target: str,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> schemas.CurrencyRateOut:
    """Retrieve the exchange rate for a specific currency pair.

    Validates parameters and queries cache first before executing db lookup.
    """
    if len(base) != 3 or len(target) != 3:
        raise BadRequestException(
            message="Currency codes must be exactly 3-character ISO codes."
        )

    rate = await services.get_rate(db, redis, base, target)
    if not rate:
        raise NotFoundException(
            message=(
                f"Exchange rate for pair {base.upper()}/{target.upper()} was not found."
            )
        )

    return rate


@router.post("/rates", response_model=schemas.CurrencyRateOut)
async def update_exchange_rate(
    rate_in: schemas.CurrencyRateCreate,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
    _current_user_id: str = Depends(get_current_user_id),
) -> schemas.CurrencyRateOut:
    """Create or update an exchange rate.

    This route is protected. Requires a valid JWT Authorization Bearer header.
    """
    rate = await services.update_or_create_rate(
        db,
        redis,
        base=rate_in.base_currency,
        target=rate_in.target_currency,
        rate=rate_in.rate,
    )
    return rate


@router.websocket("/ws/{pair}")
async def currency_websocket_endpoint(websocket: WebSocket, pair: str) -> None:
    """Subscribe to real-time updates for a currency pair (e.g., EURUSD).

    Establishes connection, registers user to the channel, and monitors socket state.
    """
    pair_upper = pair.upper()
    if len(pair_upper) != 6:
        # 3 chars base + 3 chars target = 6 chars
        await websocket.close(
            code=status.WS_1008_POLICY_VIOLATION,
            reason="Currency pair must be exactly 6 characters.",
        )
        return

    await ws_manager.connect(websocket, pair_upper)
    try:
        while True:
            # Blocks until a message is received from client, maintaining connection
            # If client disconnects, WebSocketDisconnect is raised.
            data = await websocket.receive_text()
            # Simple ACK to prove socket connectivity
            await websocket.send_json({"event": "ack", "payload": data})
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, pair_upper)
    except Exception:
        ws_manager.disconnect(websocket, pair_upper)
