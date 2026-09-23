import type { Request, Response, NextFunction } from "express";
import { clientsService } from "../clients.service.ts";
import { externalApiService } from "../../external-api.service.ts";

export const clientsController = {
	async getClients(req: Request, res: Response, next: NextFunction) {
		try {
			res.json(await clientsService.getAll());
		} catch (err) {
			next(err);
		}
	},

	async getById(req: Request, res: Response, next: NextFunction) {
		try {
			const id = Array.isArray(req.params.id)
				? req.params.id[0]
				: req.params.id;
			// Request to the other clusters:
			const traceId = req.headers["x-trace-id"];
			const forwardHeaders: HeadersInit = {
				authorization: req.headers.authorization ?? "",
				"x-trace-id": Array.isArray(traceId)
					? traceId[0]
					: (traceId ?? ""),
			};

			const [client, clusterGCP, clusterOCI] =
				await Promise.all([
					clientsService.getById(id),
					externalApiService.getData(
						process.env.GCP_CLUSTER_URL!,
						"apostadores",
						forwardHeaders,
					),
					externalApiService.getData(
						process.env.OCI_CLUSTER_URL!,
						"traders",
						forwardHeaders,
					),
				]);
			res.json({
				client,
				clusterGCP,
				clusterOCI
			});
		} catch (err) {
			next(err);
		}
	},

	async queryClients(req: Request, res: Response, next: NextFunction) {
		try {
			res.json(await clientsService.searchClient(req.body ?? {}));
		} catch (err) {
			next(err);
		}
	},

	async create(req: Request, res: Response, next: NextFunction) {
		try {
			res.status(201).json(await clientsService.create(req.body));
		} catch (err) {
			next(err);
		}
	},

	async replace(req: Request, res: Response, next: NextFunction) {
		try {
			const id = Array.isArray(req.params.id)
				? req.params.id[0]
				: req.params.id;
			res.json(await clientsService.replace(id, req.body));
		} catch (err) {
			next(err);
		}
	},

	async patch(req: Request, res: Response, next: NextFunction) {
		try {
			const id = Array.isArray(req.params.id)
				? req.params.id[0]
				: req.params.id;
			res.json(await clientsService.patch(id, req.body));
		} catch (err) {
			next(err);
		}
	},

	async delete(req: Request, res: Response, next: NextFunction) {
		try {
			const id = Array.isArray(req.params.id)
				? req.params.id[0]
				: req.params.id;
			await clientsService.delete(id);
			res.status(204).send();
		} catch (err) {
			next(err);
		}
	},
};
