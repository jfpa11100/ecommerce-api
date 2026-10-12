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