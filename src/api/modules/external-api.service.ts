export class externalApiService {
	static async getData(
		targetCluster: string,
		entity: string,
		headers: HeadersInit,
	): Promise<{
		available: boolean;
		data?: unknown;
		error?: string;
	}> {
		try {
			const response = await fetch(`${targetCluster}/api/v1/${entity}`, {
				method: "GET",
				headers,
				signal: AbortSignal.timeout(5000),
			});

			if (!response.ok) {
				return {
					available: false,
					error: `External API returned ${response.status}`,
				};
			}

			const result = await response.json();
			// Randomly select one of the results to return
			const idx = Math.floor(Math.random() * result.length);
			return {
				available: true,
				data:{
					[entity]: Array.isArray(result) && result.length > 0
						? result[idx]
						: "No results",
				}
			};
		} catch (error) {
			return {
				available: false,
				error: "External API did not respond",
			};
		}
	}
}
