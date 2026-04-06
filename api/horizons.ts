import type { VercelRequest, VercelResponse } from "@vercel/node";

const HORIZONS_URL = "https://ssd.jpl.nasa.gov/api/horizons.api";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const query = new URLSearchParams(req.query as Record<string, string>);
  const url = `${HORIZONS_URL}?${query.toString()}`;

  const upstream = await fetch(url);
  const body = await upstream.text();

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.status(upstream.status).send(body);
}
