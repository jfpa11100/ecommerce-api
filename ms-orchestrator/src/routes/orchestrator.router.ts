import { Router } from "express";
import { config, isClusterTarget } from "../config.ts";
import { sendRequestMessage } from "../queue/sqs-producer.ts";
import { waitForResponse } from "../shared/pending-requests.ts";

export const orchestrateRouter = Router();


// Use example:
//   GET  /api/gcp/predictions
//   POST /api/aws/ecommerce    body: { ... }
//   POST /api/oci/trader   body: { ... }
// The segment after /api/ (aws | gcp | oci) indicates which cluster the 
// request should go to. 
// The rest of the path is forwarded as is to the target cluster.

orchestrateRouter.all('/api/:target/*splat', async (req, res) => {
  const { target } = req.params;

  if (!isClusterTarget(target)) {
    res.status(400).json({
      traceId: req.traceId,
      error: `Invalid cluster: ${target}. Use one of: ${Object.keys(config.clusters).join(', ')}`,
    });
    return;
  }

  const downstreamPath = req.originalUrl.replace(`/api/${target}`, '') || '/';

  try {
    // Send to Request to SQS queue
    await sendRequestMessage({
      traceId: req.traceId,
      target,
      method: req.method,
      path: downstreamPath,
      payload: req.body,
    });

    // Wait for the response from the target cluster
    const response = await waitForResponse(req.traceId, config.requestTimeoutMs);
    res.status(response.status).json(response.body);
  } catch (error) {
    res.status(504).json({
      traceId: req.traceId,
      error: 'the destination cluster did not respond in time',
    });
  }
});
