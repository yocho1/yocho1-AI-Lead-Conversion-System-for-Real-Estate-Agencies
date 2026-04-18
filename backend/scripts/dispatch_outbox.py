from worker.processor import dispatch_outbox_once


if __name__ == "__main__":
    dispatch_outbox_once(limit=200)
