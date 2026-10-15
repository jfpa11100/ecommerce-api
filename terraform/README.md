# Infraestructura AWS con Terraform

Despliega una API RESTful (Node.js + Express + TypeScript) con base de datos PostgreSQL en AWS.

El despliegue es automático con **GitHub Actions** (autenticación OIDC) y la base de datos se inicializa sola con el esquema de `docker/init.sql` cuando se crea por primera vez.

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
| ECS (tarea de un solo uso) | `db_init.tf` | Aplica `docker/init.sql` en el RDS, solo cuando el RDS se crea o se recrea |

Archivos de apoyo: `providers.tf` (providers y región), `backend.tf` (estado remoto en S3), `variables.tf` (parámetros), `outputs.tf` (URL de la API, ECR y RDS).

## Estructura del repositorio

```
.
├── .github/workflows/deploy.yml   # Pipeline de despliegue
├── bootstrap/                     # Se aplica UNA vez a mano: proveedor OIDC + rol de GitHub Actions
├── terraform/                     # Infraestructura de la aplicación (la despliega el pipeline)
├── docker/init.sql                # Esquema de la base de datos
├── Dockerfile                     # Imagen de la API
└── src/ ...                       # Código de la API
```

## Cómo funciona el despliegue

Cada `git push` a `main` ejecuta el pipeline (también se puede lanzar a mano desde *Actions → Run workflow*):

| Paso | Qué hace |
|---|---|
| 1. Credenciales OIDC | GitHub pide a AWS credenciales temporales (1 hora) para el rol `github-actions-ecommerce-api` |
| 2. `init`, `fmt`, `validate` | Inicializa Terraform con el estado en S3 y valida el código |
| 3. Crear solo el ECR | `terraform apply -target=aws_ecr_repository.app` (ECS necesita que la imagen exista) |
| 4. Construir y subir la imagen | `docker build` y `docker push` con la etiqueta del SHA del commit |
| 5. `terraform apply` completo | Crea RDS, secreto, esquema de la base de datos, ALB y servicio ECS |
| 6. Smoke test | Llama a `/health` con reintentos; el pipeline falla si la API no responde |

**Carga del esquema.** `db_init.tf` lanza una tarea Fargate de un solo uso con la imagen oficial de `postgres`, dentro de la VPC, que ejecuta `docker/init.sql` contra el RDS. Se ejecuta solo cuando el RDS se crea por primera vez o se recrea, no en los despliegues posteriores:

| Situación | ¿Se aplica el esquema? |
|---|---|
| Primer despliegue o despliegue tras un `destroy` | Sí |
| Nuevo push, nueva imagen, cambios en la API | No |
| Cambios en `docker/init.sql` con la base ya creada | No (es un esquema inicial, no un sistema de migraciones) |
| El esquema falla al aplicarse | El pipeline falla y el servicio ECS no se despliega |

## Requisitos previos

- [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.10 (necesario para el bloqueo de estado en S3)
- [AWS CLI](https://aws.amazon.com/cli/) v2 con permisos para crear los recursos anteriores
- Git y un repositorio en GitHub con Actions habilitado
- Docker (solo si quieres probar la imagen en local; el pipeline la construye por ti)

## Configura AWS

Los comandos que se deben lanzar manualmente en el  PC (preparación inicial, `destroy`, consultas) necesitan credenciales vigentes en la terminal:

```powershell
aws sts get-caller-identity

# Si pide autenticarse
aws login

# Luego:
aws configure export-credentials --format powershell | Invoke-Expression
```

Las credenciales caducan. Antes de un comando largo (por ejemplo `terraform destroy`), volver a comprobar `aws sts get-caller-identity`. .

## Preparación inicial (una sola vez)

Esto se hace una única vez por cuenta de AWS y repositorio. Después, desplegar es solo hacer `git push`.

### 1. Bucket de S3 para el estado de Terraform

```powershell
$REGION     = "us-east-2"
$ACCOUNT_ID = aws sts get-caller-identity --query Account --output text
$BUCKET     = "ecommerce-api-tfstate-$ACCOUNT_ID"

aws s3api create-bucket --bucket $BUCKET --region $REGION --create-bucket-configuration LocationConstraint=$REGION
aws s3api put-bucket-versioning --bucket $BUCKET --versioning-configuration Status=Enabled
aws s3api put-public-access-block --bucket $BUCKET --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

### 2. Proveedor OIDC y rol de GitHub Actions

Este stack va aparte de `terraform/` a propósito: el pipeline necesita el rol para ejecutarse, y un `terraform destroy` de la aplicación no debe borrar el rol con el que se despliega.

GitHub identifica tu repositorio en el token con **IDs numéricos** (`usuario@ID/repo@ID`), y la política del rol debe coincidir exactamente con ese formato. 

Aplica el stack con el resultado:

```powershell
cd bootstrap
terraform init
terraform apply -var="github_repository=jfpa11100@110949752/ecommerce-api@1334233505"
terraform output github_actions_role_arn
```

Si el proveedor OIDC de GitHub ya existía en la cuenta (error `EntityAlreadyExists`), impórtalo antes del `apply`:

```powershell
$V = "-var=github_repository=jfpa11100@110949752/ecommerce-api@1334233505"
terraform import $V aws_iam_openid_connect_provider.github "arn:aws:iam::${ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"
```

**No ejecutar `terraform destroy` en `bootstrap/`** a no ser que se quiera eliminar la autenticación del pipeline.

### 3. Variables en GitHub

En el repositorio: *Settings → Secrets and variables → Actions → Variables*, crea:

| Variable | Valor |
|---|---|
| `AWS_ROLE_ARN` | El ARN que devolvió `terraform output github_actions_role_arn` |
| `TF_STATE_BUCKET` | El valor de `$BUCKET` (por ejemplo `ecommerce-api-tfstate-<ID_CUENTA>`) |

## Desplegar la API

Con la preparación hecha, desplegar es subir el código a `main`:

```powershell
cd terraform
terraform fmt -recursive
cd ..

git add .
git commit -m "Despliegue"
git push origin main
```

Sigue la ejecución en la pestaña *Actions* de GitHub. La primera vez tarda ~15-20 minutos (la mayor parte es la creación del RDS).

Al terminar, comprueba que todo funciona:

```powershell
cd terraform
terraform init -backend-config="bucket=$BUCKET"

# Prueba la API
Invoke-RestMethod "$(terraform output -raw api_url)/health"

# Comprueba que el esquema se aplicó (debe listar las tablas)
aws logs tail /ecs/ecommerce-api-prod-db-init --since 1h --region us-east-2
```

> No ejecutes `terraform apply` ni `destroy` desde tu PC mientras el pipeline está corriendo: ambos usan el mismo estado y se bloquearían entre sí. Los comandos de Terraform locales necesitan siempre `init` con `-backend-config="bucket=..."`.

## Actualizar la API

Tras cambiar el código, haz commit y push. El pipeline construye una imagen nueva (etiquetada con el SHA del commit), Terraform actualiza la task definition y ECS hace el despliegue. La base de datos no se toca y el esquema no se vuelve a aplicar:

```powershell
git add .
git commit -m "Cambios en la API"
git push origin main
```

Si se cambian archivos de `terraform/`, ejecuta antes `terraform fmt -recursive` dentro de esa carpeta y sigue el mismo flujo.

## Borrar la infraestructura

Para eliminar la infraestructura se necesita credenciales vigentes:

```powershell
aws sts get-caller-identity

cd terraform
terraform init -backend-config="bucket=$BUCKET"
terraform destroy      # escribe "yes" para confirmar
```


Comprueba que no queden recursos (especialmente el **NAT Gateway**, la **IP elástica** y **RDS**, que son los que generan cargos):

```powershell
aws rds describe-db-instances --region us-east-2 --query "DBInstances[].DBInstanceIdentifier" --output text
aws ec2 describe-nat-gateways --region us-east-2 --filter Name=state,Values=available,pending --query "NatGateways[].NatGatewayId" --output text
aws ec2 describe-addresses --region us-east-2 --query "Addresses[].PublicIp" --output text
```

El bucket de estado, el proveedor OIDC y el rol de `bootstrap/` permanecen y no generan coste.

## Volver a desplegar

Tras un `destroy`, el estado en S3 queda vacío y el pipeline recrea todo desde cero (ECR, imagen, RDS, **esquema de la base de datos** y servicio ECS). No hace falta repetir la preparación inicial.

Se puede lanzar de cualquiera de estas formas:

- En GitHub: *Actions → Deploy → Run workflow*, rama `main`.
- Desde la terminal, con un commit vacío:

```powershell
git commit --allow-empty -m "Redesplegar"
git push origin main
```

Cuando termine, repite las comprobaciones de la sección *Desplegar la API*.
