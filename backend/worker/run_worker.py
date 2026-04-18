import argparse

from .processor import run_worker


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Lead event worker")
    parser.add_argument("--demo", action="store_true", help="Run demo-only worker queue")
    args = parser.parse_args()
    run_worker(is_demo=args.demo)
