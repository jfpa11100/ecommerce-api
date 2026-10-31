# ---------------------------------------
# Amazon ALB: Application Load Balancer
# Blue/Green para CodeDeploy: 2 target groups + listener de produccion + listener de pruebas
# ---------------------------------------

resource "aws_lb" "main" {
  name               = "${var.project_name}-${var.environment}-alb"
  load_balancer_type = "application"
  internal           = false
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id
}

resource "aws_lb_target_group" "blue" {
  name        = "${var.project_name}-${var.environment}-tg-blue"
  port        = var.container_port
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip" # for Fargate (awsvpc)

  health_check {
    path                = var.health_check_path
    matcher             = "200"
    interval            = 10
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  deregistration_delay = 30
}

moved {
  from = aws_lb_target_group.app
  to   = aws_lb_target_group.blue
}

# Target group "green": recibe las tareas de la nueva version (canary).
resource "aws_lb_target_group" "green" {
  name        = "${var.project_name}-${var.environment}-tg-green"
  port        = var.container_port
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    path                = var.health_check_path
    matcher             = "200"
    interval            = 10
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  deregistration_delay = 30
}

# Listener de Producción (puerto 80): CodeDeploy reparte aqui el trafico real
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.blue.arn
  }

  lifecycle {
    ignore_changes = [default_action]
  }
}

# Listener de Pruebas (Etapa 0): trafico 0% publico. Solo llega la gente que
# conoce el puerto y esta permitida en el security group.
resource "aws_lb_listener" "test" {
  load_balancer_arn = aws_lb.main.arn
  port              = var.test_listener_port
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.green.arn
  }

  lifecycle {
    ignore_changes = [default_action]
  }
}
