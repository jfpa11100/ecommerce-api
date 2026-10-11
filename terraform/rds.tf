# ----------------------------------
# Amazon RDS (PostgreSQL)
# ----------------------------------

resource "random_password" "db" {
  length  = 24
  special = false # avoid special characters to prevent issues with connection string
}

resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-${var.environment}-db-subnets"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_db_instance" "postgres" {
  identifier = "${var.project_name}-${var.environment}-db"

  engine         = "postgres"
  engine_version = "16"
  instance_class = var.db_instance_class

  allocated_storage = var.db_allocated_storage
  storage_type      = "gp3"
  storage_encrypted = true

  db_name  = var.db_name
  username = var.db_username
  password = random_password.db.result

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false
  multi_az               = var.db_multi_az

  backup_retention_period = 7

  # Values for an academic exercise. 
  # In production: deletion_protection = true and skip_final_snapshot = false.
  deletion_protection = false
  skip_final_snapshot = true
}
