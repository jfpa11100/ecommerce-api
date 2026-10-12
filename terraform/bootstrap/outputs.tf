output "github_actions_role_arn" {
  description = "Cópialo en la variable AWS_ROLE_ARN de GitHub"
  value       = aws_iam_role.github_actions.arn
}