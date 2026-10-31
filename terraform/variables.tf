# ---------- General ----------
variable "aws_region" {
  description = "AWS Region"
  type        = string
  default     = "us-east-2"
}

variable "project_name" {
  description = "Project Name; Used as a prefix of the resources"
  type        = string
  default     = "ecommerce-api"
}

variable "environment" {
  description = "Environment (dev, staging, test, prod)"
  type        = string
  default     = "dev"
}

# ---------- Network ----------
variable "vpc_cidr" {
  description = "CIDR VPC Block"
  type        = string
  default     = "10.0.0.0/16"
}

# ---------- Container / ECS ----------
variable "container_port" {
  description = "Port exposed by the container"
  type        = number
  default     = 3000
}

variable "image_tag" {
  description = "Tag of the Docker image in ECR"
  type        = string
  default     = "latest"
}

variable "health_check_path" {
  description = "Health check path exposed by the API"
  type        = string
  default     = "/health"
}

variable "task_cpu" {
  description = "CPU of the Fargate task (256 = 0.25 vCPU)"
  type        = number
  default     = 256
}

variable "task_memory" {
  description = "Memory of the Fargate task in MiB"
  type        = number
  default     = 512
}

variable "desired_count" {
  description = "Number of tasks (containers) running"
  type        = number
  default     = 2
}

# ---------- Base de datos ----------
variable "db_name" {
  description = "Name of the database"
  type        = string
  default     = "ecommercedb"
}

variable "db_username" {
  description = "Administrator user for PostgreSQL"
  type        = string
  default     = "ecommerceuser"
}

variable "db_instance_class" {
  description = "Size of the RDS instance"
  type        = string
  default     = "db.t4g.micro"
}

variable "db_allocated_storage" {
  description = "Allocated storage from database in GB"
  type        = number
  default     = 20
}

variable "db_multi_az" {
  description = "Whether to create a Multi-AZ RDS instance (high availability)"
  type        = bool
  default     = false
}

variable "db_init_image" {
  description = "Client psql Image "
  type        = string
  default     = "public.ecr.aws/docker/library/postgres:16-alpine"
}

variable "schema_sql_path" {
  description = "SQL schema file path, relative to the terraform folder"
  type        = string
  default     = "../docker/init.sql"
}

variable "db_init_log_retention_days" {
  description = "Log retention days for the initialization task"
  type        = number
  default     = 1
}
# ---------- Progressive Deployment (Native ECS) ----------
variable "image_digest" {
  description = "Digest de la imagen en ECR (sha256:...). Si se define, se usa en lugar de image_tag (artefacto inmutable)"
  type        = string
  default     = ""

  validation {
    condition     = var.image_digest == "" || can(regex("^sha256:[a-f0-9]{64}$", var.image_digest))
    error_message = "image_digest debe tener el formato sha256:<64 caracteres hexadecimales>."
  }
}

variable "app_version" {
  description = "Version de la aplicacion de la task definition base (la API la devuelve en X-App-Version)"
  type        = string
  default     = "v2"
}

variable "app_track" {
  description = "Track de la task definition base: stable o canary (la API lo devuelve en X-App-Track)"
  type        = string
  default     = "stable"
}

variable "test_listener_port" {
  description = "Puerto del listener de pruebas del ALB (Etapa 0 del canary)"
  type        = number
  default     = 8080
}

variable "test_listener_cidrs" {
  description = "CIDRs con acceso al listener de pruebas, p. ej. [\"203.0.113.10/32\"]. Vacio = puerto cerrado"
  type        = list(string)
  default     = []
}

variable "linear_step_percent" {
  description = "Porcentaje de trafico real que se mueve a la revision nueva en cada paso (3 a 100)"
  type        = number
  default     = 10
}

variable "linear_step_bake_time_minutes" {
  description = "Minutos de observacion despues de cada paso de trafico"
  type        = number
  default     = 2
}

variable "deployment_bake_time_minutes" {
  description = "Minutos que se conserva la revision anterior tras mover todo el trafico (ventana de rollback)"
  type        = number
  default     = 5
}
