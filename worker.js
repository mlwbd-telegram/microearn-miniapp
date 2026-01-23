/**
 * MicroEarn - Cloudflare Worker Backend
 * Complete production-ready backend for Telegram Mini App earning platform (COIN ECONOMY)
 * 
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DB (D1 Database binding)
 * - TELEGRAM_MAIN_BOT_TOKEN
 * - FRONTEND_URL
 * - BACKEND_URL
 */

// ============================================
// ADMIN AUTHENTICATION CONSTANTS
// ============================================
// Password: Shovons@77392#
const ADMIN_PASSWORD_HASH = 'f4e99ac11b508aa9a25198ff84d0a2e5518a84ea2c2450b126426d01fc219461';
const ADMIN_PASSWORD_SALT = 'MicroEarn#UltraAdmin2026';
const JWT_SECRET = 'MicroEarn_JWT_Secret_2026_Ultra_Secure'; // Change this in production

// ============================================
// CONFIGURATION - COIN ECONOMY
// ============================================
const CONFIG = {
  DAILY_INCOME: 20,  // 20 coins per day
  AD_REWARD: 7,      // 7 coins per rewarded ad
  REFERRAL_BONUS: 50, // 50 coins per successful referral
  MIN_WITHDRAWAL: 5000, // 5000 coins minimum (৳100)
  MAX_ADS_PER_DAY: 5,   // Maximum 5 ads per day
  COIN_TO_BDT_RATE: 0.02 // 1000 coins = ৳20 (for display only)
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
      // Test endpoint for debugging
      if (path === '/api/test') {
        return jsonResponse({
          success: true,
          message: 'Worker is running!',
          env_vars: {
            has_bot_token: !!env.TELEGRAM_MAIN_BOT_TOKEN,
            has_frontend_url: !!env.FRONTEND_URL,
            has_db: !!env.DB
          }
        });
      }

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
      if (path === '/api/earn/daily-status') {
        return await handleDailyStatus(request, env);
      }
      // Watch Ads endpoints
      if (path === '/api/ads/status') {
        return await handleAdsStatus(request, env);
      }
      if (path === '/api/earn/watch-ad') {
        return await handleWatchAd(request, env);
      }
      // Games endpoints
      if (path === '/api/games/status') {
        return await handleGamesStatus(request, env);
      }
      if (path === '/api/games/reward') {
        return await handleGameReward(request, env);
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

      // Offer Postback Handlers - REMOVED (no longer using CPX/BitLabs)

      return jsonResponse({ error: 'Not found' }, 404);

    } catch (error) {
      console.error('Worker error:', error);
      return jsonResponse({
        error: 'Internal server error',
        debug: error.message,
        stack: error.stack?.substring(0, 200)
      }, 500);
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

    // Ensure user exists
    const user = await ensureUserExists(env, telegramUser, startParam);

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
    console.log('Daily income request received');

    // Check if DB exists
    if (!env.DB) {
      console.error('DB not found in environment');
      return jsonResponse({ success: false, error: 'Database not configured' }, 500);
    }

    const body = await request.json();
    console.log('Request body parsed');

    // Check bot token
    if (!env.TELEGRAM_MAIN_BOT_TOKEN) {
      console.error('Bot token missing');
      return jsonResponse({ success: false, error: 'Bot token not configured' }, 500);
    }

    const telegramUser = await validateTelegramInitData(body.initData, env.TELEGRAM_MAIN_BOT_TOKEN);
    if (!telegramUser) {
      console.error('Telegram validation failed');
      return jsonResponse({ success: false, error: 'Invalid Telegram data' }, 401);
    }

    // Ensure user exists
    await ensureUserExists(env, telegramUser);

    console.log('User validated:', telegramUser.id);

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD (resets at 00:00 UTC)

    // Check if already claimed today (only 1 claim per 24 hours)
    const existingClaim = await env.DB.prepare(
      'SELECT * FROM daily_claims WHERE telegram_id = ? AND claim_date = ? AND type = ?'
    ).bind(telegramUser.id, today, 'DAILY').first();

    if (existingClaim) {
      return jsonResponse({ success: false, error: 'Already collected today. Come back tomorrow!' }, 400);
    }

    // Fixed amount: 20 coins
    const amount = CONFIG.DAILY_INCOME;

    // Get user
    const user = await env.DB.prepare(
      'SELECT * FROM users WHERE telegram_id = ?'
    ).bind(telegramUser.id).first();

    if (!user) {
      return jsonResponse({ success: false, error: 'User not found' }, 404);
    }

    // Update balance (in coins)
    const newBalance = parseFloat(user.balance) + amount;
    const newTotalEarned = parseFloat(user.total_earned) + amount;

    await env.DB.prepare(
      'UPDATE users SET balance = ?, total_earned = ? WHERE telegram_id = ?'
    ).bind(newBalance, newTotalEarned, telegramUser.id).run();

    // Record daily claim
    await env.DB.prepare(
      'INSERT INTO daily_claims (user_id, telegram_id, claim_date, amount, type) VALUES (?, ?, ?, ?, ?)'
    ).bind(user.id, telegramUser.id, today, amount, 'DAILY').run();

    // Record earning
    await env.DB.prepare(
      'INSERT INTO earnings (user_id, telegram_id, type, amount) VALUES (?, ?, ?, ?)'
    ).bind(user.id, telegramUser.id, 'DAILY', amount).run();

    return jsonResponse({
      success: true,
      reward: amount,
      new_balance: newBalance,
      message: 'Daily income collected! Come back tomorrow for more.'
    });

  } catch (error) {
    console.error('Daily income error details:', {
      error: error.message,
      stack: error.stack,
      name: error.name
    });
    return jsonResponse({
      success: false,
      error: 'Failed to collect daily income',
      debug: error.message // Remove this in production
    }, 500);
  }
}

async function handleDailyStatus(request, env) {
  try {
    const body = await request.json();
    const telegramUser = await validateTelegramInitData(body.initData, env.TELEGRAM_MAIN_BOT_TOKEN);
    if (!telegramUser) {
      return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
    }

    const today = new Date().toISOString().split('T')[0];
    const existingClaim = await env.DB.prepare(
      'SELECT * FROM daily_claims WHERE telegram_id = ? AND claim_date = ? AND type = ?'
    ).bind(telegramUser.id, today, 'DAILY').first();

    return jsonResponse({
      success: true,
      claimed: !!existingClaim
    });
  } catch (error) {
    console.error('Daily status error:', error);
    return jsonResponse({ success: false, error: 'Failed to check status' }, 500);
  }
}

async function handleWatchAd(request, env) {
  try {
    const body = await request.json();
    const { completed } = body; // Frontend sends completed:true when ad finishes

    const telegramUser = await validateTelegramInitData(body.initData, env.TELEGRAM_MAIN_BOT_TOKEN);
    if (!telegramUser) {
      return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
    }

    // Check if ad was completed
    if (!completed) {
      return jsonResponse({ success: false, error: 'Ad was not completed' }, 400);
    }

    const today = new Date().toISOString().split('T')[0];

    // Count ads watched today
    const adCount = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM daily_claims WHERE telegram_id = ? AND claim_date = ? AND type = ?'
    ).bind(telegramUser.id, today, 'AD').first();

    if (adCount.count >= CONFIG.MAX_ADS_PER_DAY) {
      return jsonResponse({
        success: false,
        error: `Daily ad limit reached (${CONFIG.MAX_ADS_PER_DAY}/${CONFIG.MAX_ADS_PER_DAY})`
      }, 400);
    }

    // Get or Create user
    const user = await ensureUserExists(env, telegramUser);
    if (!user) {
      return jsonResponse({ success: false, error: 'Database error: Could not create user' }, 500);
    }

    // Reward: 7 coins
    const reward = CONFIG.AD_REWARD;
    const newBalance = parseFloat(user.balance) + reward;
    const newTotalEarned = parseFloat(user.total_earned) + reward;

    // Update balance
    await env.DB.prepare(
      'UPDATE users SET balance = ?, total_earned = ? WHERE telegram_id = ?'
    ).bind(newBalance, newTotalEarned, telegramUser.id).run();

    // Record ad watch with specific ad number (AD_1, AD_2, etc.)
    const adType = `AD_${body.ad_number || 1}`;
    await env.DB.prepare(
      'INSERT INTO daily_claims (user_id, telegram_id, claim_date, amount, type) VALUES (?, ?, ?, ?, ?)'
    ).bind(user.id, telegramUser.id, today, reward, adType).run();

    // Record earning
    await env.DB.prepare(
      'INSERT INTO earnings (user_id, telegram_id, type, amount) VALUES (?, ?, ?, ?)'
    ).bind(user.id, telegramUser.id, 'AD', reward).run();

    const adsRemaining = CONFIG.MAX_ADS_PER_DAY - (adCount.count + 1);

    return jsonResponse({
      success: true,
      amount: reward,
      new_balance: newBalance,
      ads_remaining: adsRemaining
    });

  } catch (error) {
    console.error('Watch ad error:', error);
    return jsonResponse({ success: false, error: 'Failed to process ad reward' }, 500);
  }
}

// Get status of all 5 ad slots for today
async function handleAdsStatus(request, env) {
  try {
    const body = await request.json();
    const telegramUser = await validateTelegramInitData(body.initData, env.TELEGRAM_MAIN_BOT_TOKEN);
    if (!telegramUser) {
      return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
    }

    const today = new Date().toISOString().split('T')[0];

    // Get all ad completions for today
    const completedAds = await env.DB.prepare(
      'SELECT * FROM daily_claims WHERE telegram_id = ? AND claim_date = ? AND type LIKE ?'
    ).bind(telegramUser.id, today, 'AD_%').all();

    // Build status for 5 ad slots
    const completedNumbers = completedAds.results.map(ad => parseInt(ad.type.replace('AD_', '')));
    const ads = [1, 2, 3, 4, 5].map(num => ({
      number: num,
      completed: completedNumbers.includes(num)
    }));

    return jsonResponse({
      success: true,
      ads,
      completed: completedNumbers.length,
      total: 5
    });

  } catch (error) {
    console.error('Ads status error:', error);
    return jsonResponse({ success: false, error: 'Failed to get ads status' }, 500);
  }
}

// Get games status and daily earnings
async function handleGamesStatus(request, env) {
  try {
    const body = await request.json();
    const telegramUser = await validateTelegramInitData(body.initData, env.TELEGRAM_MAIN_BOT_TOKEN);
    if (!telegramUser) {
      return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
    }

    // Ensure user exists
    await ensureUserExists(env, telegramUser);

    const today = new Date().toISOString().split('T')[0];

    // Get today's game earnings
    const gameEarnings = await env.DB.prepare(
      'SELECT SUM(amount) as total FROM daily_claims WHERE telegram_id = ? AND claim_date = ? AND type LIKE ?'
    ).bind(telegramUser.id, today, 'GAME_%').first();

    // Get play counts per game
    const gamePlays = await env.DB.prepare(
      'SELECT type, COUNT(*) as plays FROM daily_claims WHERE telegram_id = ? AND claim_date = ? AND type LIKE ? GROUP BY type'
    ).bind(telegramUser.id, today, 'GAME_%').all();

    const playCountsMap = {};
    gamePlays.results.forEach(g => {
      playCountsMap[g.type] = g.plays;
    });

    const games = [
      { id: 'spin', name: 'Spin & Win', maxPlays: 2, plays: playCountsMap['GAME_SPIN'] || 0 },
      { id: 'tap', name: 'Tap Challenge', maxPlays: 3, plays: playCountsMap['GAME_TAP'] || 0 },
      { id: 'quiz', name: 'Quiz Game', maxPlays: 99, plays: playCountsMap['GAME_QUIZ'] || 0 },
      { id: 'guess', name: 'Guess Number', maxPlays: 2, plays: playCountsMap['GAME_GUESS'] || 0 },
      { id: 'reaction', name: 'Reaction Game', maxPlays: 2, plays: playCountsMap['GAME_REACTION'] || 0 },
      { id: 'catch', name: 'Catch Button', maxPlays: 2, plays: playCountsMap['GAME_CATCH'] || 0 }
    ];

    // Check Weekly 50 Coin Lock Status
    const spin50Locked = await checkWeeklySpinBonus(env, telegramUser.id);

    return jsonResponse({
      success: true,
      games,
      today_earnings: gameEarnings.total || 0,
      // max_daily: 25, // REMOVED
      limit_reached: false, // Always false now
      spin_50_locked: spin50Locked // Frontend uses this to grey out 50 verification
    });

  } catch (error) {
    console.error('Games status error:', error);
    return jsonResponse({ success: false, error: 'Failed to get games status' }, 500);
  }
}

// Check if user has won 50 coins in the last 7 days (Weekly Bonus Rule)
async function checkWeeklySpinBonus(env, telegramId) {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Check for any SPIN reward of 50 coins in the last 7 days
    const bonusClaim = await env.DB.prepare(
      `SELECT * FROM daily_claims 
       WHERE telegram_id = ? 
       AND type = 'GAME_SPIN' 
       AND amount = 50 
       AND claim_date >= ?`
    ).bind(telegramId, sevenDaysAgo).first();

    return !!bonusClaim; // True if locked (already claimed), False if available
  } catch (error) {
    console.error('Check weekly bonus error:', error);
    return true; // Fail safe: lock if error
  }
}

// Process game reward with enhanced logging and error handling
async function handleGameReward(request, env) {
  const requestId = `GR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  console.log(`[${requestId}] Game reward request received`);

  try {
    const body = await request.json();
    const { game_type, score, reward, session_id } = body;

    console.log(`[${requestId}] Processing: game_type=${game_type}, score=${score}, reward=${reward}`);

    // Validate required fields
    if (!game_type || reward === undefined) {
      console.log(`[${requestId}] ERROR: Missing required fields`);
      return jsonResponse({
        success: false,
        error: 'Missing required fields: game_type and reward are required',
        error_code: 'MISSING_FIELDS',
        request_id: requestId
      }, 400);
    }

    const telegramUser = await validateTelegramInitData(body.initData, env.TELEGRAM_MAIN_BOT_TOKEN);
    if (!telegramUser) {
      console.log(`[${requestId}] ERROR: Telegram validation failed`);
      return jsonResponse({
        success: false,
        error: 'Telegram authentication failed. Please restart the app.',
        error_code: 'AUTH_FAILED',
        request_id: requestId
      }, 401);
    }

    console.log(`[${requestId}] User validated: telegram_id=${telegramUser.id}`);

    const today = new Date().toISOString().split('T')[0];

    // Check daily game earnings cap (25 coins)
    const todayTotal = await env.DB.prepare(
      'SELECT SUM(amount) as total FROM daily_claims WHERE telegram_id = ? AND claim_date = ? AND type LIKE ?'
    ).bind(telegramUser.id, today, 'GAME_%').first();

    console.log(`[${requestId}] Today's game earnings: ${todayTotal.total || 0} (No imit)`);

    // REMOVED: Daily 25 coin limit check
    /*
    if ((todayTotal.total || 0) >= 25) {
      console.log(`[${requestId}] ERROR: Daily limit reached`);
      return jsonResponse({
        success: false,
        error: 'Daily game earnings limit reached (25 coins). Come back tomorrow!',
        error_code: 'DAILY_LIMIT_REACHED',
        today_earned: todayTotal.total || 0,
        request_id: requestId
      }, 400);
    }
    */

    // Check play limits per game
    const gameType = `GAME_${game_type.toUpperCase()}`;
    const playLimits = { GAME_SPIN: 2, GAME_TAP: 3, GAME_QUIZ: 99, GAME_GUESS: 2, GAME_REACTION: 2, GAME_CATCH: 2 };
    const maxPlays = playLimits[gameType] || 2;

    const playCount = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM daily_claims WHERE telegram_id = ? AND claim_date = ? AND type = ?'
    ).bind(telegramUser.id, today, gameType).first();

    console.log(`[${requestId}] ${gameType} plays today: ${playCount.count}/${maxPlays}`);

    if (playCount.count >= maxPlays) {
      console.log(`[${requestId}] ERROR: Game play limit reached for ${gameType}`);
      return jsonResponse({
        success: false,
        error: `Daily play limit reached for ${game_type} (${maxPlays} plays max)`,
        error_code: 'GAME_LIMIT_REACHED',
        plays_used: playCount.count,
        max_plays: maxPlays,
        request_id: requestId
      }, 400);
    }

    // SPECIAL RULE: Spin & Win Caps
    if (game_type === 'spin') {
      // Rule 1: 50 coins is Weekly Bonus (Once per 7 days)
      if (reward === 50) {
        const isLocked = await checkWeeklySpinBonus(env, telegramUser.id);
        if (isLocked) {
          console.log(`[${requestId}] ERROR: Weekly 50 coin limit exceeded. Rejecting.`);
          return jsonResponse({
            success: false,
            error: 'Weekly 50 coin bonus already collected. Try again next week!',
            error_code: 'WEEKLY_LIMIT_REACHED',
            request_id: requestId
          }, 400);
        }
      }
      // Rule 2: Normal days max 20 coins
      else if (reward > 20) {
        // Reject unauthorized rewards > 20 (e.g. 30 if hacked)
        return jsonResponse({
          success: false,
          error: 'Invalid reward amount for Spin & Win.',
          error_code: 'INVALID_REWARD',
          request_id: requestId
        }, 400);
      }
    }

    // Validate reward (cap at remaining daily limit)
    // REMOVED: 25 coin cap
    // const remainingDaily = 25 - (todayTotal.total || 0);
    // Strict cap: we cannot earn more than remaining daily cap
    const actualReward = reward; // Math.min(reward, remainingDaily);
    console.log(`[${requestId}] Reward calculation: requested=${reward}, actual=${actualReward}`);

    // Get or Create user
    const user = await ensureUserExists(env, telegramUser);
    if (!user) {
      return jsonResponse({ success: false, error: 'Database error: Could not create user' }, 500);
    }

    // Update balance
    const newBalance = parseFloat(user.balance) + actualReward;
    const newTotalEarned = parseFloat(user.total_earned) + actualReward;

    console.log(`[${requestId}] Updating balance: ${user.balance} + ${actualReward} = ${newBalance}`);

    await env.DB.prepare('UPDATE users SET balance = ?, total_earned = ? WHERE telegram_id = ?')
      .bind(newBalance, newTotalEarned, telegramUser.id).run();

    // Record game play
    await env.DB.prepare('INSERT INTO daily_claims (user_id, telegram_id, claim_date, amount, type) VALUES (?, ?, ?, ?, ?)')
      .bind(user.id, telegramUser.id, today, actualReward, gameType).run();

    // Record earning
    await env.DB.prepare('INSERT INTO earnings (user_id, telegram_id, type, amount) VALUES (?, ?, ?, ?)')
      .bind(user.id, telegramUser.id, gameType, actualReward).run();

    console.log(`[${requestId}] SUCCESS: Credited ${actualReward} coins to user ${telegramUser.id}`);

    return jsonResponse({
      success: true,
      reward: actualReward,
      new_balance: newBalance,
      today_game_earnings: (todayTotal.total || 0) + actualReward,
      request_id: requestId
    });

  } catch (error) {
    console.error(`[${requestId}] CRITICAL ERROR:`, error.message, error.stack);
    return jsonResponse({
      success: false,
      error: `DEBUG: ${error.message}`, // Return actual error for debugging
      error_code: 'SERVER_ERROR',
      debug_message: error.message,
      request_id: requestId
    }, 500);
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
        error: `Minimum withdrawal is ${CONFIG.MIN_WITHDRAWAL} coins`
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
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

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
    const rewardAmount = parseFloat(url.searchParams.get('reward_value') || '0');
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

    const rewardAmount = parseFloat(String(reward));

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
      "SELECT * FROM admin_sessions WHERE token = ? AND expires_at > datetime('now')"
    ).bind(token).first();

    return !!session;

  } catch (error) {
    return false;
  }
}

async function ensureUserExists(env, telegramUser, startParam) {
  let user = await env.DB.prepare('SELECT * FROM users WHERE telegram_id = ?').bind(telegramUser.id).first();
  if (!user) {
    const referralCode = generateReferralCode();
    // Use INSERT OR IGNORE to handle race conditions (parallel calls)
    await env.DB.prepare(
      `INSERT OR IGNORE INTO users (telegram_id, username, first_name, last_name, referral_code, referred_by)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(
      telegramUser.id,
      telegramUser.username || null,
      telegramUser.first_name || null,
      telegramUser.last_name || null,
      referralCode,
      null
    ).run();

    user = await env.DB.prepare('SELECT * FROM users WHERE telegram_id = ?').bind(telegramUser.id).first();

    if (startParam) {
      await processReferral(env, telegramUser.id, startParam);
    }
  } else {
    // Update last active
    await env.DB.prepare(
      "UPDATE users SET last_active = datetime('now') WHERE telegram_id = ?"
    ).bind(telegramUser.id).run();
  }
  return user;
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
