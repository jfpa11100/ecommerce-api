# ---------------------------------------
# Security Groups -> ALB -> ECS -> RDS
# ---------------------------------------

resource "aws_security_group" "alb" {
  name        = "${var.project_name}-${var.environment}-alb-sg"
  description = "Allows HTTP from Internet into the ALB"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP from Internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Allows access to the canary test listener only if the list of CIDRs is not empty.
  dynamic "ingress" {
    for_each = length(var.test_listener_cidrs) > 0 ? [1] : []
    content {
      description = "Canary test listener (acceso interno de pruebas)"
      from_port   = var.test_listener_port
      to_port     = var.test_listener_port
      protocol    = "tcp"
      cidr_blocks = var.test_listener_cidrs
    }
  }

  egress {
    description = "All outgoing traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "ecs" {
  name        = "${var.project_name}-${var.environment}-ecs-sg"
  description = "Allows traffic from ALB to ECS containers"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Traffic from ALB to ECS containers"
    from_port       = var.container_port
    to_port         = var.container_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    description = "Outgoing traffic (ECR, Secrets Manager, CloudWatch via NAT)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "rds" {
  name        = "${var.project_name}-${var.environment}-rds-sg"
  description = "Allows PostgreSQL access only from ECS containers"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Access PostgreSQL from ECS"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }
}
