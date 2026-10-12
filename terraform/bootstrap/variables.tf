variable "aws_region" {
  type    = string
  default = "us-east-2"
}

variable "project_name" {
  type    = string
  default = "ecommerce-api"
}

variable "github_repository" {
  description = "Repository with format user/repository"
  type        = string
}

variable "github_branch" {
  description = "Only the authorized branch for deployment"
  type        = string
  default     = "main"
}