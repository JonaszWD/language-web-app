.PHONY: dev migrate seed logs stop clean

dev:
	docker compose up --build

migrate:
	docker compose exec backend alembic upgrade head

seed:
	docker compose exec backend python seed.py

logs:
	docker compose logs -f

stop:
	docker compose down

clean:
	docker compose down -v --remove-orphans
