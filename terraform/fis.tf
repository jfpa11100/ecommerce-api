# --------- AWS FIS: experimentos de caos (+ alarma de aborto) ----------

data "aws_caller_identity" "current" {}

# Rol que FIS asume para ejecutar las acciones
resource "aws_iam_role" "fis" {
  name = "${var.project_name}-${var.environment}-fis"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "fis.amazonaws.com" }
      Action    = "sts:AssumeRole"
      Condition = {
        StringEquals = { "aws:SourceAccount" = data.aws_caller_identity.current.account_id }
      }
    }]
  })
}

resource "aws_iam_role_policy" "fis_ecs" {
  name = "fis-ecs"
  role = aws_iam_role.fis.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["ecs:StopTask", "ecs:DescribeTasks", "ecs:ListTasks"]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["tag:GetResources"]
        Resource = "*"
      }
    ]
  })
}

# Alarma que actúa como freno de emergencia (stop condition)
resource "aws_cloudwatch_metric_alarm" "chaos_abort" {
  alarm_name          = "${var.project_name}-${var.environment}-chaos-abort"
  alarm_description   = "Aborta experimentos de caos si los 5xx superan el umbral"
  comparison_operator = "GreaterThanThreshold"
  threshold           = 300
  evaluation_periods  = 2
  datapoints_to_alarm = 2
  treat_missing_data  = "notBreaching"

  metric_query {
    id          = "total5xx"
    expression  = "elb5xx + target5xx"
    label       = "5xx totales"
    return_data = true
  }

  metric_query {
    id = "elb5xx"
    metric {
      namespace   = "AWS/ApplicationELB"
      metric_name = "HTTPCode_ELB_5XX_Count"
      period      = 60
      stat        = "Sum"
      dimensions  = { LoadBalancer = aws_lb.main.arn_suffix }
    }
  }

  metric_query {
    id = "target5xx"
    metric {
      namespace   = "AWS/ApplicationELB"
      metric_name = "HTTPCode_Target_5XX_Count"
      period      = 60
      stat        = "Sum"
      dimensions  = { LoadBalancer = aws_lb.main.arn_suffix }
    }
  }
}

# Experimento: detener el 50% de las tareas de la API
resource "aws_fis_experiment_template" "stop_tasks" {
  description = "Detener 50% de las tareas de la API"
  role_arn    = aws_iam_role.fis.arn

  stop_condition {
    source = "aws:cloudwatch:alarm"
    value  = aws_cloudwatch_metric_alarm.chaos_abort.arn
  }

  action {
    name      = "stop-tasks"
    action_id = "aws:ecs:stop-task"

    target {
      key   = "Tasks"
      value = "api-tasks"
    }
  }

  target {
    name           = "api-tasks"
    resource_type  = "aws:ecs:task"
    selection_mode = "PERCENT(50)"

    parameters = {
      cluster = aws_ecs_cluster.main.arn
      service = aws_ecs_service.app.name
    }
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-chaos-stop-tasks"
  }
}