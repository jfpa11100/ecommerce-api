# Inventario de controles de ecommerce (AWS)

Borrador llenado a partir de su Terraform (`terraform/*.tf`) y del código de la API. «Estado» es lo que se leyó en el repositorio; **revisar cada fila contra la cuenta real** antes de entregar. Mapeo con MITRE D3FEND (D3-ITF, D3-ACH, D3-UAP y D3-RO se comprobaron en d3fend.mitre.org) y con ISO/IEC 27001:2022 Anexo A y NIST SP 800-53 (numeración verificada contra los catálogos oficiales).

## Identidad

| Control | Dónde | Estado | Señal | D3FEND / normas |
|---|---|---|---|---|
| Despliegue sin llaves de larga duración: GitHub entra a AWS con un rol OIDC | `chaos.yml`, `deploy.yml`, `terraform/bootstrap/iam.tf` | Activo | CloudTrail (si está activo) | ISO 5.15, 8.2; NIST AC-6, IA-5 |
| Secretos en Secrets Manager (URL de la base y `CHAOS_TOKEN`), con permiso de lectura acotado | `terraform/secrets.tf`, `iam.tf` | Activo | Eventos de Secrets Manager | D3-UAP; ISO 5.17; NIST IA-5, AC-6 |
| Rotación de los secretos | Secrets Manager | **Hueco**: no hay rotación configurada | Ninguna | D3-CRO; ISO 5.17; NIST IA-5 |

## Red

| Control | Dónde | Estado | Señal | D3FEND / normas |
|---|---|---|---|---|
| Tareas y base de datos en subredes privadas, sin IP pública | `vpc.tf`, `ecs.tf`, `rds.tf` | Activo | Registros de flujo (si se activan) | D3-ITF; ISO 8.20, 8.22; NIST SC-7 |
| Solo el ALB entra a las tareas (grupo de seguridad) | `security_groups.tf` | Activo | | D3-ITF; ISO 8.22; NIST SC-7 |
| Entrada pública al ALB | `security_groups.tf`, `alb.tf` | **Hueco**: HTTP en el puerto 80 desde `0.0.0.0/0`, **sin TLS** (listener HTTP, sin certificado) y sin WAF | Métricas del ALB | D3-ITF; ISO 8.20, 8.24; NIST SC-7, SC-28 |
| Registros de flujo de la VPC | `vpc.tf` | **Hueco**: no se encontró `aws_flow_log` | Ninguna | ISO 8.15, 8.16; NIST SI-4 |

## Carga de trabajo

| Control | Dónde | Estado | Señal | D3FEND / normas |
|---|---|---|---|---|
| Imagen en ECR y despliegue por pipeline con pruebas | `ecr.tf`, `deploy.yml`, `tests/` | Activo | Resultado del pipeline | ISO 8.28; NIST SA-11 |
| Interruptor de fallos protegido por token (`x-chaos-token`) y apagado por defecto | `src/middlewares/fault.ts` | Activo, con matiz: si `CHAOS_TOKEN` no está definido, **cualquiera** puede activar el fallo | Log `chaos: true` | D3-ACH; ISO 8.9; NIST CM-7 |
| Escaneo de vulnerabilidades de las imágenes en cada push | `ecr.tf` (`scan_on_push = true`) | Activo | Hallazgos de ECR | ISO 8.8; NIST SI-2 |

## Datos

| Control | Dónde | Estado | Señal | D3FEND / normas |
|---|---|---|---|---|
| Base de datos privada y cifrada en reposo | `rds.tf` (`publicly_accessible = false`, `storage_encrypted = true`) | Activo | Eventos de RDS | ISO 8.24; NIST SC-28 |
| Copias de seguridad de la base | `rds.tf` | **Hueco**: `backup_retention_period = 1`, `deletion_protection = false`, `skip_final_snapshot = true` | Ninguna | D3-RO; ISO 8.13; NIST CP-9 |
| Alta disponibilidad de la base | `rds.tf` | `multi_az` controlado por variable (por defecto falso) | | ISO 8.14; NIST CP-6 |

## Detección y respuesta

| Control | Dónde | Estado | Señal | D3FEND / normas |
|---|---|---|---|---|
| Log JSON por petición con trace id, estado y duración | `request-logger.ts` | Activo | CloudWatch Logs `/ecs/ecommerce-api-dev` | ISO 8.15; NIST AU-3 |
| Retención de logs | `ecs.tf` | 14 días | | ISO 8.15; NIST AU-11 |
| Container Insights | `ecs.tf` | Activo | Métricas de ECS | ISO 8.16; NIST SI-4 |
| Alarma de aborto por 5xx | `chaos.tf` | Activo | Alarma de CloudWatch | ISO 8.16; NIST SI-4 |
| Detección de texto plantado en las rutas del log | CloudWatch | **Hueco**: no hay filtro ni alarma; la API registra la ruta tal como llega | Ninguna hoy | ISO 8.16; NIST SI-4, SI-10 |
| Auditoría de la cuenta (CloudTrail) y detección de amenazas (GuardDuty) | cuenta de AWS | **Por revisar**: no aparecen en el Terraform | | ISO 8.15; NIST AU-2, SI-4 |

## Huecos que cierra la ronda 1 de su experimento

| Hueco | Mejora |
|---|---|
| Sin detección de rutas con texto plantado | Filtro de métricas + alarma + correo (ver `deteccion/`) |
| El analista de IA recibe esa telemetría tal cual | Sanitizar la entrada y verificar la respuesta (`seguridad/ia/analista.py` de trading-journal) |

Los demás huecos (HTTP sin TLS, sin rotación, copias de 1 día, sin flow logs) quedan fuera del alcance de las rondas y se declaran como **riesgos residuales** en el informe.
