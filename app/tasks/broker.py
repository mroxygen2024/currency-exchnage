import taskiq_redis
from taskiq import AsyncBroker, InMemoryBroker

from app.core.config import settings

# Define the broker using redis list queues.
# If in testing mode, we can use an InMemoryBroker to avoid requiring a running Redis instance.
if settings.ENV == "testing":
    broker = InMemoryBroker()
else:
    broker = taskiq_redis.ListQueueBroker(
        settings.redis_url,
        queue_name="currency_tracker_tasks",
    )

# Register the FastAPI application target to allow tasks to resolve
# FastAPI dependencies (like Database sessions and Redis clients) directly.
# This requires running: taskiq worker app.tasks.broker:broker --fs-discover
