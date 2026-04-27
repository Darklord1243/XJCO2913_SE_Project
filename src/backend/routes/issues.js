const express = require('express');
const { authenticateRequest, requireStaff } = require('../auth-middleware');
const { normalizeId, normalizeText } = require('../booking-service');
const {
  createIssue,
  findIssueById,
  getIssues,
  updateIssue,
} = require('../database');

const router = express.Router();

const ALLOWED_ISSUE_PRIORITIES = new Set(['low', 'high']);
const ALLOWED_ISSUE_STATUSES = new Set(['open', 'resolved']);

function toIsoTimestamp(value) {
  if (!value) {
    return null;
  }

  return `${String(value).replace(' ', 'T')}Z`;
}

function mapIssueRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    scooterId: row.scooter_id,
    description: row.description,
    priority: row.priority,
    status: row.status,
    createdAt: toIsoTimestamp(row.created_at),
    updatedAt: toIsoTimestamp(row.updated_at),
  };
}

function parseIssueId(rawId) {
  const numericId = Number(rawId);

  if (!Number.isInteger(numericId) || numericId <= 0) {
    return null;
  }

  return numericId;
}

router.post('/issues', async (req, res) => {
  try {
    const user = await authenticateRequest(req, res);

    if (!user) {
      return;
    }

    const scooterId = normalizeId(req.body?.scooterId);
    const description = normalizeText(req.body?.description);

    if (!scooterId) {
      return res.status(400).json({
        success: false,
        error: 'Scooter ID is required.',
      });
    }

    if (!description) {
      return res.status(400).json({
        success: false,
        error: 'Issue description is required.',
      });
    }

    const createdIssue = await createIssue({
      userId: user.id,
      scooterId,
      description,
      priority: 'low',
      status: 'open',
    });

    return res.status(201).json({
      success: true,
      data: mapIssueRow(createdIssue),
    });
  } catch (error) {
    console.error(`POST ${req.baseUrl}${req.path} failed:`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create issue.',
    });
  }
});

// ---------------------------------------------------------------------------
// ID 15: Staff list issues, with optional status / priority filters
// (e.g. ?priority=high to see only escalated issues)
// ---------------------------------------------------------------------------

router.get('/issues', async (req, res) => {
  try {
    const user = await authenticateRequest(req, res);

    if (!user) {
      return;
    }

    if (!requireStaff(res, user)) {
      return;
    }

    const filters = {};
    const rawStatus = normalizeText(req.query?.status);
    const rawPriority = normalizeText(req.query?.priority);

    if (rawStatus) {
      if (!ALLOWED_ISSUE_STATUSES.has(rawStatus)) {
        return res.status(400).json({
          success: false,
          error: `Status filter must be one of: ${[...ALLOWED_ISSUE_STATUSES].join(', ')}.`,
        });
      }
      filters.status = rawStatus;
    }

    if (rawPriority) {
      if (!ALLOWED_ISSUE_PRIORITIES.has(rawPriority)) {
        return res.status(400).json({
          success: false,
          error: `Priority filter must be one of: ${[...ALLOWED_ISSUE_PRIORITIES].join(', ')}.`,
        });
      }
      filters.priority = rawPriority;
    }

    const rows = await getIssues(filters);

    return res.status(200).json({
      success: true,
      data: rows.map(mapIssueRow),
    });
  } catch (error) {
    console.error(`GET ${req.baseUrl}${req.path} failed:`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch issues.',
    });
  }
});

// ---------------------------------------------------------------------------
// Staff escalate issue priority (e.g. low -> high)
// ---------------------------------------------------------------------------

router.patch('/issues/:id/priority', async (req, res) => {
  try {
    const user = await authenticateRequest(req, res);

    if (!user) {
      return;
    }

    if (!requireStaff(res, user)) {
      return;
    }

    const issueId = parseIssueId(req.params.id);

    if (issueId == null) {
      return res.status(400).json({
        success: false,
        error: 'Invalid issue ID.',
      });
    }

    const priority = normalizeText(req.body?.priority);

    if (!ALLOWED_ISSUE_PRIORITIES.has(priority)) {
      return res.status(400).json({
        success: false,
        error: `Priority must be one of: ${[...ALLOWED_ISSUE_PRIORITIES].join(', ')}.`,
      });
    }

    const existing = await findIssueById(issueId);

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Issue not found.',
      });
    }

    const updated = await updateIssue(issueId, { priority });

    if (!updated) {
      // Defensive: row vanished between the existence check and the update.
      return res.status(404).json({
        success: false,
        error: 'Issue not found.',
      });
    }

    return res.status(200).json({
      success: true,
      data: mapIssueRow(updated),
    });
  } catch (error) {
    console.error(`PATCH ${req.baseUrl}${req.path} failed:`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update issue priority.',
    });
  }
});

// ---------------------------------------------------------------------------
// ID 14: Staff resolve issue (open -> resolved)
// ---------------------------------------------------------------------------

router.patch('/issues/:id/status', async (req, res) => {
  try {
    const user = await authenticateRequest(req, res);

    if (!user) {
      return;
    }

    if (!requireStaff(res, user)) {
      return;
    }

    const issueId = parseIssueId(req.params.id);

    if (issueId == null) {
      return res.status(400).json({
        success: false,
        error: 'Invalid issue ID.',
      });
    }

    const status = normalizeText(req.body?.status);

    if (!ALLOWED_ISSUE_STATUSES.has(status)) {
      return res.status(400).json({
        success: false,
        error: `Status must be one of: ${[...ALLOWED_ISSUE_STATUSES].join(', ')}.`,
      });
    }

    const existing = await findIssueById(issueId);

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Issue not found.',
      });
    }

    const updated = await updateIssue(issueId, { status });

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Issue not found.',
      });
    }

    return res.status(200).json({
      success: true,
      data: mapIssueRow(updated),
    });
  } catch (error) {
    console.error(`PATCH ${req.baseUrl}${req.path} failed:`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update issue status.',
    });
  }
});

module.exports = router;
