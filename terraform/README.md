# Infraestructura AWS con Terraform

Despliega una API RESTful (Node.js + Express + TypeScript) con base de datos PostgreSQL en AWS.

## Qué crea Terraform

```
Internet ──(80)──▶ ALB ──(3000)──▶ ECS Fargate ──(5432)──▶ RDS PostgreSQL
                (públicas)          (privadas)               (privadas)
```

| Servicio AWS | Archivo | Función |
|---|---|---|
| VPC | `vpc.tf`, `security_groups.tf` | Red con 2 subredes públicas y 2 privadas en 2 zonas de disponibilidad, Internet Gateway, NAT Gateway y firewalls (Security Groups) encadenados |
| ECR | `ecr.tf` | Repositorio privado de imágenes Docker, con escaneo de vulnerabilidades |
| RDS | `rds.tf` | PostgreSQL 16 cifrado, en subredes privadas, sin acceso público |
| Secrets Manager | `secrets.tf` | Guarda la `DATABASE_URL` con una contraseña generada automáticamente |
| IAM | `iam.tf` | Rol de ejecución (descargar imagen, leer el secreto, escribir logs) y rol de tarea |
| ALB | `alb.tf` | Balanceador público que reparte el tráfico HTTP y comprueba la salud de la API |
| ECS Fargate + CloudWatch | `ecs.tf` | Cluster, task definition y servicio que ejecutan los contenedores; logs en CloudWatch |

Archivos de apoyo: `providers.tf` (providers y región), `variables.tf` (parámetros), `outputs.tf` (URL de la API, ECR y RDS).

## Requisitos previos

- [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.5
- [AWS CLI](https://aws.amazon.com/cli/) configurado (`aws configure`) con permisos para crear los recursos anteriores
- Docker

## Configura AWS
```bash
aws sts get-caller-identity

#Si pide autenticarse
aws login

# Luego:
aws configure export-credentials --format powershell | Invoke-Expression
```

## Crear la infraestructura

Ejecuta los comandos de Terraform desde la carpeta `terraform/`.

```bash
cd terraform

# 1. Configurar variables (opcional: ajusta los valores)
cp terraform.tfvars.example terraform.tfvars

# 2. Inicializar: descarga los providers
terraform init

# 3. Validar sintaxis
terraform validate

# 4. Crear solo el repositorio ECR (ECS necesita que la imagen exista)
terraform apply -target=aws_ecr_repository.app
```

Construye y sube la imagen desde la **raíz de la API**:

```bash
cd ..

ECR_URL=$(terraform -chdir=terraform output -raw ecr_repository_url)
REGION=us-east-2   # la misma de terraform.tfvars

aws ecr get-login-password --region $REGION | \
  docker login --username AWS --password-stdin ${ECR_URL%%/*}

docker build -t $ECR_URL:latest .
docker push $ECR_URL:latest
```

Crea el resto de la infraestructura:

```bash
cd terraform

# Revisa qué se va a crear
terraform plan

# Crear todo (escribe "yes" para confirmar). Tarda ~10-15 minutos
terraform apply
```

Al terminar, Terraform muestra los outputs. Prueba la API:

```bash
curl $(terraform output -raw api_url)/health
```

## Actualizar la API

Tras cambiar el código, sube una nueva imagen y fuerza un nuevo despliegue:

```bash
docker build -t $ECR_URL:latest .
docker push $ECR_URL:latest

aws ecs update-service \
  --cluster $(terraform -chdir=terraform output -raw ecs_cluster_name) \
  --service mi-api-dev-service \
  --force-new-deployment \
  --region $REGION
```

## Borrar la infraestructura

Para evitar costos, destruye todo cuando termines:

```bash
cd terraform
terraform destroy      # escribe "yes" para confirmar
```

Comprueba en la consola de AWS que no queden recursos (especialmente el **NAT Gateway**, la **IP elástica** y **RDS**, que son los que generan cargos).



