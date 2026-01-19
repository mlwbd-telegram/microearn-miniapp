/**
 * MicroEarn - Cloudflare Worker Backend
 * Complete production-ready backend for Telegram Mini App earning platform
 * 
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DB (D1 Database binding)
 * - TELEGRAM_MAIN_BOT_TOKEN
 * - FRONTEND_URL
 * - BACKEND_URL
 * - CPX_APP_ID
 * - BITLABS_TOKEN
 */

// ============================================
// ADMIN AUTHENTICATION CONSTANTS
// ============================================
const ADMIN_PASSWORD_HASH = 'b6f67be010d46e099c8d8692f1a796e0895faffc81ec1ef485150fdebfe9c050';
const ADMIN_PASSWORD_SALT = 'MicroEarn#UltraAdmin2026';
const JWT_SECRET = 'MicroEarn_JWT_Secret_2026_Ultra_Secure'; // Change this in production

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
  DAILY_INCOME_MIN: 5,
  DAILY_INCOME_MAX: 25,
  REFERRAL_BONUS: 50,
  MIN_WITHDRAWAL: 100,
  CPX_POSTBACK_SECRET: 'your_cpx_secret', // Set your CPX postback secret
  BITLABS_POSTBACK_SECRET: 'your_bitlabs_secret' // Set your BitLabs postback secret
};

// ============================================
// CORS HEADERS
// ============================================
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

// ============================================
// MAIN HANDLER
// ============================================
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    try {
      // User API Routes
      if (path === '/api/user/init') {
        return await handleUserInit(request, env);
      }
      if (path === '/api/user/profile') {
        return await handleUserProfile(request, env);
      }
      if (path === '/api/earn/daily') {
        return await handleDailyIncome(request, env);
      }
      if (path === '/api/earn/ad') {
        return await handleAdRequest(request, env);
      }
      if (path === '/api/earn/survey') {
        return await handleSurveyRequest(request, env);
      }
      if (path === '/api/withdraw/request') {
        return await handleWithdrawRequest(request, env);
      }
      if (path === '/api/history') {
        return await handleHistory(request, env);
      }

      // Admin API Routes
      if (path === '/api/admin/login') {
        return await handleAdminLogin(request, env);
      }
      if (path === '/api/admin/stats') {
        return await handleAdminStats(request, env);
      }
      if (path === '/api/admin/users') {
        return await handleAdminUsers(request, env);
      }
      if (path === '/api/admin/withdrawals') {
        return await handleAdminWithdrawals(request, env);
      }
      if (path === '/api/admin/withdraw/approve') {
        return await handleApproveWithdrawal(request, env);
      }
      if (path === '/api/admin/withdraw/reject') {
        return await handleRejectWithdrawal(request, env);
      }
      if (path === '/api/admin/user/reset-balance') {
        return await handleResetBalance(request, env);
      }

      // Telegram Bot Webhook
      if (path === '/webhook/telegram') {
        return await handleTelegramWebhook(request, env);
      }

      // Offer Postback Handlers
      if (path === '/postback/cpx') {
        return await handleCPXPostback(request, env);
      }
      if (path === '/postback/bitlabs') {
        return await handleBitLabsPostback(request, env);
      }

      return jsonResponse({ error: 'Not found' }, 404);

    } catch (error) {
      console.error('Worker error:', error);
      return jsonResponse({ error: 'Internal server error' }, 500);
    }
  }
};

// ============================================
// USER API HANDLERS
// ============================================

async function handleUserInit(request, env) {
  try {
    const body = await request.json();
    const { initData, startParam } = body;

    // Validate Telegram WebApp data
    const telegramUser = await validateTelegramInitData(initData, env.TELEGRAM_MAIN_BOT_TOKEN);
    if (!telegramUser) {
      return jsonResponse({ success: false, error: 'Invalid Telegram data' }, 401);
    }

    // Check if user exists
    let user = await env.DB.prepare(
      'SELECT * FROM users WHERE telegram_id = ?'
    ).bind(telegramUser.id).first();

    if (!user) {
      // Create new user
      const referralCode = generateReferralCode();

      await env.DB.prepare(
        `INSERT INTO users (telegram_id, username, first_name, last_name, referral_code, referred_by)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(
        telegramUser.id,
        telegramUser.username || null,
        telegramUser.first_name || null,
        telegramUser.last_name || null,
        referralCode,
        null
      ).run();

      user = await env.DB.prepare(
        'SELECT * FROM users WHERE telegram_id = ?'
      ).bind(telegramUser.id).first();

      // Handle referral if startParam exists
      if (startParam) {
        await processReferral(env, telegramUser.id, startParam);
      }
    } else {
      // Update last active
      await env.DB.prepare(
        'UPDATE users SET last_active = datetime("now") WHERE telegram_id = ?'
      ).bind(telegramUser.id).run();
    }

    return jsonResponse({
      success: true,
      user: {
        telegram_id: user.telegram_id,
        username: user.username,
        balance: parseFloat(user.balance),
        total_earned: parseFloat(user.total_earned),
        referral_code: user.referral_code
      }
    });

  } catch (error) {
    console.error('User init error:', error);
    return jsonResponse({ success: false, error: 'Failed to initialize user' }, 500);
  }
}

async function handleUserProfile(request, env) {
  try {
    const body = await request.json();
    const telegramUser = await validateTelegramInitData(body.initData, env.TELEGRAM_MAIN_BOT_TOKEN);
    if (!telegramUser) {
      return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
    }

    const user = await env.DB.prepare(
      'SELECT * FROM users WHERE telegram_id = ?'
    ).bind(telegramUser.id).first();

    if (!user) {
      return jsonResponse({ success: false, error: 'User not found' }, 404);
    }

    return jsonResponse({
      success: true,
      user: {
        telegram_id: user.telegram_id,
        username: user.username,
        balance: parseFloat(user.balance),
        total_earned: parseFloat(user.total_earned),
        referral_code: user.referral_code
      }
    });

  } catch (error) {
    console.error('Profile error:', error);
    return jsonResponse({ success: false, error: 'Failed to get profile' }, 500);
  }
}

async function handleDailyIncome(request, env) {
  try {
    const body = await request.json();
    const telegramUser = await validateTelegramInitData(body.initData, env.TELEGRAM_MAIN_BOT_TOKEN);
    if (!telegramUser) {
      return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
    }

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Check if already claimed today
    const existingClaim = await env.DB.prepare(
      'SELECT * FROM daily_claims WHERE telegram_id = ? AND claim_date = ?'
    ).bind(telegramUser.id, today).first();

    if (existingClaim) {
      return jsonResponse({ success: false, error: 'Already collected today' }, 400);
    }

    // Generate random amount
    const amount = Math.random() * (CONFIG.DAILY_INCOME_MAX - CONFIG.DAILY_INCOME_MIN) + CONFIG.DAILY_INCOME_MIN;
    const roundedAmount = Math.round(amount * 100) / 100;

    // Get user
    const user = await env.DB.prepare(
      'SELECT * FROM users WHERE telegram_id = ?'
    ).bind(telegramUser.id).first();

    if (!user) {
      return jsonResponse({ success: false, error: 'User not found' }, 404);
    }

    // Update balance
    const newBalance = parseFloat(user.balance) + roundedAmount;
    const newTotalEarned = parseFloat(user.total_earned) + roundedAmount;

    await env.DB.prepare(
      'UPDATE users SET balance = ?, total_earned = ? WHERE telegram_id = ?'
    ).bind(newBalance, newTotalEarned, telegramUser.id).run();

    // Record daily claim
    await env.DB.prepare(
      'INSERT INTO daily_claims (user_id, telegram_id, claim_date, amount) VALUES (?, ?, ?, ?)'
    ).bind(user.id, telegramUser.id, today, roundedAmount).run();

    // Record earning
    await env.DB.prepare(
      'INSERT INTO earnings (user_id, telegram_id, type, amount) VALUES (?, ?, ?, ?)'
    ).bind(user.id, telegramUser.id, 'DAILY', roundedAmount).run();

    return jsonResponse({
      success: true,
      amount: roundedAmount,
      new_balance: newBalance
    });

  } catch (error) {
    console.error('Daily income error:', error);
    return jsonResponse({ success: false, error: 'Failed to collect daily income' }, 500);
  }
}

async function handleAdRequest(request, env) {
  try {
    const body = await request.json();
    const telegramUser = await validateTelegramInitData(body.initData, env.TELEGRAM_MAIN_BOT_TOKEN);
    if (!telegramUser) {
      return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
    }

    // Generate CPX Research offer URL
    const offerUrl = `https://offers.cpx-research.com/index.php?app_id=${env.CPX_APP_ID}&ext_user_id=${telegramUser.id}`;

    return jsonResponse({
      success: true,
      offer_url: offerUrl
    });

  } catch (error) {
    console.error('Ad request error:', error);
    return jsonResponse({ success: false, error: 'Failed to load ads' }, 500);
  }
}

async function handleSurveyRequest(request, env) {
  try {
    const body = await request.json();
    const telegramUser = await validateTelegramInitData(body.initData, env.TELEGRAM_MAIN_BOT_TOKEN);
    if (!telegramUser) {
      return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
    }

    // Generate BitLabs survey URL
    const surveyUrl = `https://web.bitlabs.ai/?token=${env.BITLABS_TOKEN}&uid=${telegramUser.id}`;

    return jsonResponse({
      success: true,
      survey_url: surveyUrl
    });

  } catch (error) {
    console.error('Survey request error:', error);
    return jsonResponse({ success: false, error: 'Failed to load surveys' }, 500);
  }
}

async function handleWithdrawRequest(request, env) {
  try {
    const body = await request.json();
    const { amount, method, account } = body;
    
    const telegramUser = await validateTelegramInitData(body.initData, env.TELEGRAM_MAIN_BOT_TOKEN);
    if (!telegramUser) {
      return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
    }

    if (amount < CONFIG.MIN_WITHDRAWAL) {
      return jsonResponse({ 
        success: false, 
        error: `Minimum withdrawal is ৳${CONFIG.MIN_WITHDRAWAL}` 
      }, 400);
    }

    const user = await env.DB.prepare(
      'SELECT * FROM users WHERE telegram_id = ?'
    ).bind(telegramUser.id).first();

    if (!user) {
      return jsonResponse({ success: false, error: 'User not found' }, 404);
    }

    if (parseFloat(user.balance) < amount) {
      return jsonResponse({ success: false, error: 'Insufficient balance' }, 400);
    }

    // Create withdrawal request
    await env.DB.prepare(
      `INSERT INTO withdrawals (user_id, telegram_id, username, amount, method, account, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      user.id,
      telegramUser.id,
      user.username,
      amount,
      method,
      account,
      'PENDING'
    ).run();

    return jsonResponse({
      success: true,
      message: 'Withdrawal request submitted'
    });

  } catch (error) {
    console.error('Withdraw request error:', error);
    return jsonResponse({ success: false, error: 'Failed to submit withdrawal' }, 500);
  }
}

async function handleHistory(request, env) {
  try {
    const body = await request.json();
    const telegramUser = await validateTelegramInitData(body.initData, env.TELEGRAM_MAIN_BOT_TOKEN);
    if (!telegramUser) {
      return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
    }

    const earnings = await env.DB.prepare(
      `SELECT type, amount, created_at 
       FROM earnings 
       WHERE telegram_id = ? 
       ORDER BY created_at DESC 
       LIMIT 50`
    ).bind(telegramUser.id).all();

    const withdrawals = await env.DB.prepare(
      `SELECT amount, status, created_at 
       FROM withdrawals 
       WHERE telegram_id = ? 
       ORDER BY created_at DESC 
       LIMIT 20`
    ).bind(telegramUser.id).all();

    const history = [
      ...earnings.results.map(e => ({
        type: e.type,
        amount: parseFloat(e.amount),
        created_at: e.created_at
      })),
      ...withdrawals.results.map(w => ({
        type: `WITHDRAWAL (${w.status})`,
        amount: -parseFloat(w.amount),
        created_at: w.created_at
      }))
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return jsonResponse({
      success: true,
      history
    });

  } catch (error) {
    console.error('History error:', error);
    return jsonResponse({ success: false, error: 'Failed to load history' }, 500);
  }
}

// ============================================
// ADMIN API HANDLERS
// ============================================

async function handleAdminLogin(request, env) {
  try {
    const body = await request.json();
    const { password } = body;

    // Verify password
    const isValid = await verifyAdminPassword(password);
    if (!isValid) {
      return jsonResponse({ success: false, error: 'Invalid password' }, 401);
    }

    // Generate JWT token
    const token = await generateJWT({ role: 'admin' });

    // Store session
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours
    await env.DB.prepare(
      'INSERT INTO admin_sessions (token, expires_at) VALUES (?, ?)'
    ).bind(token, expiresAt).run();

    // Log admin action
    await env.DB.prepare(
      'INSERT INTO admin_actions (action_type, details) VALUES (?, ?)'
    ).bind('LOGIN', JSON.stringify({ timestamp: new Date().toISOString() })).run();

    return jsonResponse({
      success: true,
      token
    });

  } catch (error) {
    console.error('Admin login error:', error);
    return jsonResponse({ success: false, error: 'Login failed' }, 500);
  }
}

async function handleAdminStats(request, env) {
  try {
    const authToken = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!await verifyAdminToken(authToken, env)) {
      return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
    }

    const totalUsers = await env.DB.prepare('SELECT COUNT(*) as count FROM users').first();
    const totalEarnings = await env.DB.prepare('SELECT SUM(total_earned) as sum FROM users').first();
    const totalBalance = await env.DB.prepare('SELECT SUM(balance) as sum FROM users').first();
    const pendingWithdrawals = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM withdrawals WHERE status = ?'
    ).bind('PENDING').first();

    return jsonResponse({
      success: true,
      stats: {
        total_users: totalUsers.count || 0,
        total_earnings: parseFloat(totalEarnings.sum || 0),
        total_balance: parseFloat(totalBalance.sum || 0),
        pending_withdrawals: pendingWithdrawals.count || 0
      }
    });

  } catch (error) {
    console.error('Admin stats error:', error);
    return jsonResponse({ success: false, error: 'Failed to load stats' }, 500);
  }
}

async function handleAdminUsers(request, env) {
  try {
    const authToken = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!await verifyAdminToken(authToken, env)) {
      return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
    }

    const users = await env.DB.prepare(
      `SELECT u.telegram_id, u.username, u.balance, u.total_earned, u.created_at,
              (SELECT COUNT(*) FROM referrals WHERE referrer_id = u.id) as referral_count
       FROM users u
       ORDER BY u.created_at DESC
       LIMIT 500`
    ).all();

    return jsonResponse({
      success: true,
      users: users.results.map(u => ({
        telegram_id: u.telegram_id,
        username: u.username,
        balance: parseFloat(u.balance),
        total_earned: parseFloat(u.total_earned),
        referral_count: u.referral_count,
        created_at: u.created_at
      }))
    });

  } catch (error) {
    console.error('Admin users error:', error);
    return jsonResponse({ success: false, error: 'Failed to load users' }, 500);
  }
}

async function handleAdminWithdrawals(request, env) {
  try {
    const authToken = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!await verifyAdminToken(authToken, env)) {
      return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
    }

    const withdrawals = await env.DB.prepare(
      `SELECT * FROM withdrawals 
       ORDER BY created_at DESC 
       LIMIT 500`
    ).all();

    return jsonResponse({
      success: true,
      withdrawals: withdrawals.results.map(w => ({
        id: w.id,
        telegram_id: w.telegram_id,
        username: w.username,
        amount: parseFloat(w.amount),
        method: w.method,
        account: w.account,
        status: w.status,
        created_at: w.created_at
      }))
    });

  } catch (error) {
    console.error('Admin withdrawals error:', error);
    return jsonResponse({ success: false, error: 'Failed to load withdrawals' }, 500);
  }
}

async function handleApproveWithdrawal(request, env) {
  try {
    const authToken = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!await verifyAdminToken(authToken, env)) {
      return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
    }

    const body = await request.json();
    const { withdrawal_id } = body;

    const withdrawal = await env.DB.prepare(
      'SELECT * FROM withdrawals WHERE id = ?'
    ).bind(withdrawal_id).first();

    if (!withdrawal) {
      return jsonResponse({ success: false, error: 'Withdrawal not found' }, 404);
    }

    if (withdrawal.status !== 'PENDING') {
      return jsonResponse({ success: false, error: 'Withdrawal already processed' }, 400);
    }

    // Deduct balance from user
    await env.DB.prepare(
      'UPDATE users SET balance = balance - ? WHERE telegram_id = ?'
    ).bind(withdrawal.amount, withdrawal.telegram_id).run();

    // Update withdrawal status
    await env.DB.prepare(
      'UPDATE withdrawals SET status = ?, processed_at = datetime("now") WHERE id = ?'
    ).bind('APPROVED', withdrawal_id).run();

    // Log admin action
    await env.DB.prepare(
      'INSERT INTO admin_actions (action_type, target_telegram_id, details) VALUES (?, ?, ?)'
    ).bind(
      'APPROVE_WITHDRAWAL',
      withdrawal.telegram_id,
      JSON.stringify({ withdrawal_id, amount: withdrawal.amount })
    ).run();

    return jsonResponse({ success: true });

  } catch (error) {
    console.error('Approve withdrawal error:', error);
    return jsonResponse({ success: false, error: 'Failed to approve withdrawal' }, 500);
  }
}

async function handleRejectWithdrawal(request, env) {
  try {
    const authToken = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!await verifyAdminToken(authToken, env)) {
      return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
    }

    const body = await request.json();
    const { withdrawal_id } = body;

    const withdrawal = await env.DB.prepare(
      'SELECT * FROM withdrawals WHERE id = ?'
    ).bind(withdrawal_id).first();

    if (!withdrawal) {
      return jsonResponse({ success: false, error: 'Withdrawal not found' }, 404);
    }

    if (withdrawal.status !== 'PENDING') {
      return jsonResponse({ success: false, error: 'Withdrawal already processed' }, 400);
    }

    // Update withdrawal status
    await env.DB.prepare(
      'UPDATE withdrawals SET status = ?, processed_at = datetime("now") WHERE id = ?'
    ).bind('REJECTED', withdrawal_id).run();

    // Log admin action
    await env.DB.prepare(
      'INSERT INTO admin_actions (action_type, target_telegram_id, details) VALUES (?, ?, ?)'
    ).bind(
      'REJECT_WITHDRAWAL',
      withdrawal.telegram_id,
      JSON.stringify({ withdrawal_id })
    ).run();

    return jsonResponse({ success: true });

  } catch (error) {
    console.error('Reject withdrawal error:', error);
    return jsonResponse({ success: false, error: 'Failed to reject withdrawal' }, 500);
  }
}

async function handleResetBalance(request, env) {
  try {
    const authToken = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!await verifyAdminToken(authToken, env)) {
      return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
    }

    const body = await request.json();
    const { telegram_id } = body;

    await env.DB.prepare(
      'UPDATE users SET balance = 0 WHERE telegram_id = ?'
    ).bind(telegram_id).run();

    // Log admin action
    await env.DB.prepare(
      'INSERT INTO admin_actions (action_type, target_telegram_id, details) VALUES (?, ?, ?)'
    ).bind(
      'RESET_BALANCE',
      telegram_id,
      JSON.stringify({ timestamp: new Date().toISOString() })
    ).run();

    return jsonResponse({ success: true });

  } catch (error) {
    console.error('Reset balance error:', error);
    return jsonResponse({ success: false, error: 'Failed to reset balance' }, 500);
  }
}

// ============================================
// TELEGRAM BOT WEBHOOK HANDLER
// ============================================

async function handleTelegramWebhook(request, env) {
  try {
    const update = await request.json();

    if (update.message) {
      const message = update.message;
      const chatId = message.chat.id;
      const text = message.text;

      if (text === '/start') {
        const firstName = message.from.first_name || 'User';
        
        await sendTelegramMessage(env.TELEGRAM_MAIN_BOT_TOKEN, chatId, {
          text: `🎉 Welcome to MicroEarn, ${firstName}!\n\nStart earning money by completing simple tasks.\n\nClick the button below to open the app:`,
          reply_markup: {
            inline_keyboard: [[
              {
                text: '🚀 Open App',
                web_app: { url: env.FRONTEND_URL }
              }
            ]]
          }
        });
      }
    }

    return new Response('OK', { status: 200 });

  } catch (error) {
    console.error('Telegram webhook error:', error);
    return new Response('OK', { status: 200 }); // Always return 200 to Telegram
  }
}

// ============================================
// OFFER POSTBACK HANDLERS
// ============================================

async function handleCPXPostback(request, env) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('user_id');
    const transId = url.searchParams.get('trans_id');
    const rewardAmount = parseFloat(url.searchParams.get('reward_value') || 0);
    const hash = url.searchParams.get('hash');

    // Verify postback authenticity (implement your CPX hash verification)
    // const expectedHash = await generateCPXHash(userId, transId, rewardAmount, CONFIG.CPX_POSTBACK_SECRET);
    // if (hash !== expectedHash) {
    //   return new Response('Invalid hash', { status: 403 });
    // }

    // Check for duplicate
    const existing = await env.DB.prepare(
      'SELECT * FROM offer_completions WHERE telegram_id = ? AND offer_id = ?'
    ).bind(userId, transId).first();

    if (existing) {
      await logFraud(env, userId, 'DUPLICATE_OFFER', { trans_id: transId });
      return new Response('Duplicate', { status: 200 });
    }

    // Get user
    const user = await env.DB.prepare(
      'SELECT * FROM users WHERE telegram_id = ?'
    ).bind(userId).first();

    if (!user) {
      return new Response('User not found', { status: 404 });
    }

    // Update balance
    const newBalance = parseFloat(user.balance) + rewardAmount;
    const newTotalEarned = parseFloat(user.total_earned) + rewardAmount;

    await env.DB.prepare(
      'UPDATE users SET balance = ?, total_earned = ? WHERE telegram_id = ?'
    ).bind(newBalance, newTotalEarned, userId).run();

    // Record earning
    await env.DB.prepare(
      'INSERT INTO earnings (user_id, telegram_id, type, amount, source) VALUES (?, ?, ?, ?, ?)'
    ).bind(user.id, userId, 'AD', rewardAmount, transId).run();

    // Record completion
    await env.DB.prepare(
      'INSERT INTO offer_completions (user_id, telegram_id, offer_id, offer_type, amount) VALUES (?, ?, ?, ?, ?)'
    ).bind(user.id, userId, transId, 'AD', rewardAmount).run();

    return new Response('OK', { status: 200 });

  } catch (error) {
    console.error('CPX postback error:', error);
    return new Response('Error', { status: 500 });
  }
}

async function handleBitLabsPostback(request, env) {
  try {
    const body = await request.json();
    const { uid, transaction_id, reward } = body;

    // Check for duplicate
    const existing = await env.DB.prepare(
      'SELECT * FROM offer_completions WHERE telegram_id = ? AND offer_id = ?'
    ).bind(uid, transaction_id).first();

    if (existing) {
      await logFraud(env, uid, 'DUPLICATE_OFFER', { transaction_id });
      return new Response('Duplicate', { status: 200 });
    }

    // Get user
    const user = await env.DB.prepare(
      'SELECT * FROM users WHERE telegram_id = ?'
    ).bind(uid).first();

    if (!user) {
      return new Response('User not found', { status: 404 });
    }

    const rewardAmount = parseFloat(reward);

    // Update balance
    const newBalance = parseFloat(user.balance) + rewardAmount;
    const newTotalEarned = parseFloat(user.total_earned) + rewardAmount;

    await env.DB.prepare(
      'UPDATE users SET balance = ?, total_earned = ? WHERE telegram_id = ?'
    ).bind(newBalance, newTotalEarned, uid).run();

    // Record earning
    await env.DB.prepare(
      'INSERT INTO earnings (user_id, telegram_id, type, amount, source) VALUES (?, ?, ?, ?, ?)'
    ).bind(user.id, uid, 'SURVEY', rewardAmount, transaction_id).run();

    // Record completion
    await env.DB.prepare(
      'INSERT INTO offer_completions (user_id, telegram_id, offer_id, offer_type, amount) VALUES (?, ?, ?, ?, ?)'
    ).bind(user.id, uid, transaction_id, 'SURVEY', rewardAmount).run();

    return new Response('OK', { status: 200 });

  } catch (error) {
    console.error('BitLabs postback error:', error);
    return new Response('Error', { status: 500 });
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function validateTelegramInitData(initData, botToken) {
  try {
    if (!initData) return null;

    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    params.delete('hash');

    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const secretKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode('WebAppData'),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const tokenKey = await crypto.subtle.sign(
      'HMAC',
      secretKey,
      new TextEncoder().encode(botToken)
    );

    const dataKey = await crypto.subtle.importKey(
      'raw',
      tokenKey,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign(
      'HMAC',
      dataKey,
      new TextEncoder().encode(dataCheckString)
    );

    const expectedHash = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    if (expectedHash !== hash) {
      return null;
    }

    const userData = params.get('user');
    if (userData) {
      return JSON.parse(userData);
    }

    return null;

  } catch (error) {
    console.error('Validation error:', error);
    return null;
  }
}

async function verifyAdminPassword(password) {
  const hash = await sha256(password + ADMIN_PASSWORD_SALT);
  return hash === ADMIN_PASSWORD_HASH;
}

async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function generateJWT(payload) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify({ ...payload, exp: Date.now() + 24 * 60 * 60 * 1000 }));
  const signature = await sha256(`${header}.${body}.${JWT_SECRET}`);
  return `${header}.${body}.${signature}`;
}

async function verifyAdminToken(token, env) {
  if (!token) return false;

  try {
    const session = await env.DB.prepare(
      'SELECT * FROM admin_sessions WHERE token = ? AND expires_at > datetime("now")'
    ).bind(token).first();

    return !!session;

  } catch (error) {
    return false;
  }
}

function generateReferralCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function processReferral(env, newUserId, referralCode) {
  try {
    const referrer = await env.DB.prepare(
      'SELECT * FROM users WHERE referral_code = ?'
    ).bind(referralCode).first();

    if (!referrer) return;

    if (referrer.telegram_id === newUserId) {
      await logFraud(env, newUserId, 'SELF_REFERRAL', { referral_code: referralCode });
      return;
    }

    const newUser = await env.DB.prepare(
      'SELECT * FROM users WHERE telegram_id = ?'
    ).bind(newUserId).first();

    if (!newUser) return;

    // Check for duplicate
    const existing = await env.DB.prepare(
      'SELECT * FROM referrals WHERE referrer_id = ? AND referred_id = ?'
    ).bind(referrer.id, newUser.id).first();

    if (existing) return;

    // Update referrer balance
    const newBalance = parseFloat(referrer.balance) + CONFIG.REFERRAL_BONUS;
    const newTotalEarned = parseFloat(referrer.total_earned) + CONFIG.REFERRAL_BONUS;

    await env.DB.prepare(
      'UPDATE users SET balance = ?, total_earned = ? WHERE id = ?'
    ).bind(newBalance, newTotalEarned, referrer.id).run();

    // Record referral
    await env.DB.prepare(
      `INSERT INTO referrals (referrer_id, referrer_telegram_id, referred_id, referred_telegram_id, bonus_amount, bonus_paid)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(
      referrer.id,
      referrer.telegram_id,
      newUser.id,
      newUserId,
      CONFIG.REFERRAL_BONUS,
      1
    ).run();

    // Record earning
    await env.DB.prepare(
      'INSERT INTO earnings (user_id, telegram_id, type, amount) VALUES (?, ?, ?, ?)'
    ).bind(referrer.id, referrer.telegram_id, 'REFERRAL', CONFIG.REFERRAL_BONUS).run();

    // Update new user's referred_by
    await env.DB.prepare(
      'UPDATE users SET referred_by = ? WHERE id = ?'
    ).bind(referrer.id, newUser.id).run();

  } catch (error) {
    console.error('Process referral error:', error);
  }
}

async function logFraud(env, telegramId, fraudType, details) {
  try {
    await env.DB.prepare(
      'INSERT INTO fraud_logs (telegram_id, fraud_type, details) VALUES (?, ?, ?)'
    ).bind(telegramId, fraudType, JSON.stringify(details)).run();
  } catch (error) {
    console.error('Log fraud error:', error);
  }
}

async function sendTelegramMessage(botToken, chatId, data) {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        ...data
      })
    });
  } catch (error) {
    console.error('Send message error:', error);
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: CORS_HEADERS
  });
}
