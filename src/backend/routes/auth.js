const express = require('express');
const {
  createSessionToken,
  hashPassword,
  toPublicUser,
  validateLoginInput,
  validateRegistrationInput,
  verifyPassword,
} = require('../auth-service');
const { authenticateRequest } = require('../auth-middleware');
const {
  createUser,
  findUserByEmail,
  updateUserAccountType,
} = require('../database');
const { sendRegistrationEmail } = require('../email-service');
const { isSelfRegistrableUserType } = require('../roles');

const router = express.Router();

router.post('/register', async (req, res) => {
  const validation = validateRegistrationInput(req.body || {});

  if (!validation.ok) {
    return res.status(400).json({
      success: false,
      message: validation.message,
    });
  }

  try {
    const { email, fullName, password } = validation.value;
    const rawUserType = String(req.body?.userType || '')
      .trim()
      .toLowerCase();
    // Hard guarantee: privileged roles (`staff`, `admin`) can never be
    // self-registered through this public endpoint.
    const userType = isSelfRegistrableUserType(rawUserType)
      ? rawUserType
      : 'standard';
    const existingUser = await findUserByEmail(email);

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.',
      });
    }

    const { passwordHash, passwordSalt } = hashPassword(password);
    const user = await createUser({
      email,
      fullName,
      userType,
      passwordHash,
      passwordSalt,
    });

    void sendRegistrationEmail(user);

    return res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      data: {
        token: createSessionToken(user),
        user: toPublicUser(user),
      },
    });
  } catch (error) {
    console.error('POST /api/auth/register failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create account.',
    });
  }
});

router.post('/login', async (req, res) => {
  const validation = validateLoginInput(req.body || {});

  if (!validation.ok) {
    return res.status(400).json({
      success: false,
      message: validation.message,
    });
  }

  try {
    const { email, password } = validation.value;
    const user = await findUserByEmail(email);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Walk-in accounts cannot log in (defense in depth — placeholder
    // password hashes are practically un-matchable, but reject explicitly).
    if (user.user_type === 'walkin') {
      return res.status(401).json({
        success: false,
        message: 'Walk-in accounts cannot log in.',
      });
    }

    if (!verifyPassword(password, user.password_salt, user.password_hash)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    return res.json({
      success: true,
      message: 'Login successful.',
      data: {
        token: createSessionToken(user),
        user: toPublicUser(user),
      },
    });
  } catch (error) {
    console.error('POST /api/auth/login failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to log in.',
    });
  }
});

router.patch('/profile', async (req, res) => {
  try {
    const user = await authenticateRequest(req, res);

    if (!user) {
      return;
    }

    const rawUserType = String(req.body?.userType || '')
      .trim()
      .toLowerCase();

    if (!rawUserType) {
      return res.status(400).json({
        success: false,
        message: 'userType is required.',
      });
    }

    if (!isSelfRegistrableUserType(rawUserType)) {
      return res.status(400).json({
        success: false,
        message: 'Account type must be standard, student, or senior.',
      });
    }

    const updatedUser = await updateUserAccountType(user.id, rawUserType);

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Account type updated.',
      data: {
        token: createSessionToken(updatedUser),
        user: toPublicUser(updatedUser),
      },
    });
  } catch (error) {
    console.error('PATCH /api/auth/profile failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update profile.',
    });
  }
});

module.exports = router;
