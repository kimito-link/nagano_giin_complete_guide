const postgres = require("postgres");

let client;
let setupPromise;

function getClient() {
  if (client) return client;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    const error = new Error("DATABASE_URL is not configured");
    error.statusCode = 500;
    throw error;
  }

  client = postgres(databaseUrl, {
    max: 3,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl:
      databaseUrl.includes("sslmode=require") || databaseUrl.includes("supabase.co")
        ? { rejectUnauthorized: false }
        : false,
  });
  return client;
}

function ensureTable() {
  if (setupPromise) return setupPromise;

  const sql = getClient();
  setupPromise = sql`
    create table if not exists nagano_visit_reports (
      id bigserial primary key,
      group_code text not null,
      member_key text not null,
      member_name text not null,
      address text not null,
      display_name text not null,
      visitor_token text not null,
      lat double precision not null,
      lng double precision not null,
      accuracy_m double precision,
      note text,
      reported_at timestamptz not null default now()
    )
  `.then(async () => {
    await sql`create index if not exists nagano_visit_reports_group_idx on nagano_visit_reports (group_code, reported_at desc)`;
    await sql`create index if not exists nagano_visit_reports_member_idx on nagano_visit_reports (group_code, member_key, reported_at desc)`;
  });

  return setupPromise;
}

function json(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function cleanString(value, maxLength) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function cleanNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) return null;
  return number;
}

function normalizeRow(row) {
  return {
    id: Number(row.id),
    groupCode: row.group_code,
    memberKey: row.member_key,
    memberName: row.member_name,
    address: row.address,
    displayName: row.display_name,
    lat: Number(row.lat),
    lng: Number(row.lng),
    accuracyM: row.accuracy_m == null ? null : Number(row.accuracy_m),
    note: row.note,
    reportedAt: row.reported_at,
  };
}

function buildStats(rows) {
  const memberCounts = {};
  const visitorTokens = new Set();

  for (const row of rows) {
    memberCounts[row.member_key] = (memberCounts[row.member_key] || 0) + 1;
    visitorTokens.add(row.visitor_token);
  }

  return {
    totalReports: rows.length,
    uniqueVisitors: visitorTokens.size,
    visitedMembers: Object.keys(memberCounts).length,
    latestReportedAt: rows[0]?.reported_at ?? null,
    memberCounts,
  };
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    const error = new Error("JSON body is invalid");
    error.statusCode = 400;
    throw error;
  }
}

async function handleGet(req, res) {
  const url = new URL(req.url, "https://naganogiincompleteguide.vercel.app");
  const groupCode = cleanString(url.searchParams.get("groupCode"), 80);
  if (groupCode.length < 2) {
    json(res, 400, { error: "groupCode is required" });
    return;
  }

  await ensureTable();
  const sql = getClient();
  const rows = await sql`
    select *
    from nagano_visit_reports
    where group_code = ${groupCode}
    order by reported_at desc
    limit 300
  `;

  json(res, 200, {
    reports: rows.map(normalizeRow),
    stats: buildStats(rows),
  });
}

async function handlePost(req, res) {
  const body = await readBody(req);

  const groupCode = cleanString(body.groupCode, 80);
  const memberKey = cleanString(body.memberKey, 240);
  const memberName = cleanString(body.memberName, 120);
  const address = cleanString(body.address, 240);
  const displayName = cleanString(body.displayName, 60);
  const visitorToken = cleanString(body.visitorToken, 80);
  const note = cleanString(body.note, 160);
  const lat = cleanNumber(body.lat, -90, 90);
  const lng = cleanNumber(body.lng, -180, 180);
  const accuracyM = body.accuracyM == null ? null : cleanNumber(body.accuracyM, 0, 50000);

  if (
    groupCode.length < 2 ||
    !memberKey ||
    !memberName ||
    !address ||
    !displayName ||
    !visitorToken ||
    lat == null ||
    lng == null
  ) {
    json(res, 400, { error: "required fields are missing" });
    return;
  }

  await ensureTable();
  const sql = getClient();
  const [row] = await sql`
    insert into nagano_visit_reports (
      group_code,
      member_key,
      member_name,
      address,
      display_name,
      visitor_token,
      lat,
      lng,
      accuracy_m,
      note
    )
    values (
      ${groupCode},
      ${memberKey},
      ${memberName},
      ${address},
      ${displayName},
      ${visitorToken},
      ${lat},
      ${lng},
      ${accuracyM},
      ${note || null}
    )
    returning *
  `;

  json(res, 201, { report: normalizeRow(row) });
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }
    if (req.method === "GET") {
      await handleGet(req, res);
      return;
    }
    if (req.method === "POST") {
      await handlePost(req, res);
      return;
    }
    json(res, 405, { error: "method not allowed" });
  } catch (error) {
    console.error("[visits api]", error);
    json(res, error.statusCode || 500, {
      error: error.statusCode ? error.message : "internal server error",
    });
  }
};
