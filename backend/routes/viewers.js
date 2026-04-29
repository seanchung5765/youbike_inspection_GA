//負責閱覽權限
const express = require('express');
const router = express.Router();
const db = require('../db');

// ============================================================================
// 1. GET /api/viewers - 取得已配置閱覽權限的人員列表 (清單首頁使用)
// 備註：需過濾單位與層級。
// - 若前端參數漏傳，後端會利用 user_id 自動去資料庫補齊單位與等級資訊。
// - 中階管理員 (role_level < 99) 只能看到：同單位、等級比自己低的部屬，且嚴格排除自己。
// ============================================================================
router.get('/', async (req, res) => {
  let { unit_id, role_level, user_id } = req.query;
  try {
    // 自動補完參數防呆機制
    if (!unit_id || !role_level) {
      const [uRows] = await db.query(`
        SELECT u.unit_id, br.role_level 
        FROM users u 
        INNER JOIN back_roles br ON u.back_role_id = br.id 
        WHERE u.id = ?
      `, [user_id]);
      if (uRows.length > 0) {
        unit_id = uRows[0].unit_id;
        role_level = uRows[0].role_level;
      }
    }

    let sql = `
      SELECT u.id, u.emp_id, u.name, un.name AS unit_name, fr.name AS front_role_name,
      GROUP_CONCAT(DISTINCT rg.name ORDER BY rg.id ASC SEPARATOR ', ') AS view_regions_name,
      GROUP_CONCAT(DISTINCT rg.id ORDER BY rg.id ASC SEPARATOR ',') AS view_regions_ids
      FROM users u
      LEFT JOIN units un ON u.unit_id = un.id
      LEFT JOIN front_roles fr ON u.front_role_id = fr.id
      LEFT JOIN back_roles br ON u.back_role_id = br.id 
      JOIN user_view_regions uvr ON u.id = uvr.user_id 
      LEFT JOIN report_groups rg ON uvr.report_group_id = rg.id
      WHERE 1=1
    `;
    const queryParams = [];
    
    // 執行隔離邏輯
    if (role_level < 99) { 
      sql += ` AND u.unit_id = ? AND br.role_level < ? AND u.id != ? `;
      queryParams.push(unit_id, role_level, user_id);
    }
    sql += ` GROUP BY u.id ORDER BY u.id DESC `;
    
    const [viewers] = await db.query(sql, queryParams);
    res.json({ success: true, data: viewers });
  } catch (error) {
    console.error("撈取清單發生 SQL 錯誤：", error);
    res.status(500).json({ success: false, message: "資料載入失敗" });
  }
});

// ============================================================================
// 2. GET /api/viewers/eligible-users - 取得「尚未配置」權限的人員名單
// ============================================================================
router.get('/eligible-users', async (req, res) => {
  const { user_id } = req.query; // 這是目前登入操作的主管 ID
  try {
    // 🌟 核心修正：真正的大海撈針！
    // 撈取全公司 LDAP (users 表) 的所有人，只排除「自己」與「已經在閱覽管理的人」
    const sql = `
      SELECT id, emp_id, name 
      FROM users 
      WHERE id != ?
        AND id NOT IN (SELECT DISTINCT user_id FROM user_view_regions)
    `;
    
    const [users] = await db.query(sql, [user_id]);
    res.json({ success: true, data: users });
  } catch (error) {
    console.error("抓取待分配名單失敗：", error);
    res.status(500).json({ success: false, message: "抓取名單失敗" });
  }
});

// ============================================================================
// 3. GET /api/viewers/unit-regions - 取得該單位「被授權」的地區範圍
// ============================================================================
router.get('/unit-regions', async (req, res) => {
  const { user_id, role_level } = req.query;
  try {
    const [uRows] = await db.query(`
      SELECT u.unit_id, br.role_level 
      FROM users u 
      JOIN back_roles br ON u.back_role_id = br.id 
      WHERE u.id = ?
    `, [user_id]);
    
    if (uRows.length === 0) return res.json({ success: true, data: [] });
    const { unit_id, role_level } = uRows[0];

    let sql = '';
    let params = [];

    // 🌟 核心邏輯：高階管理員看全部，中階管理員看單位允許的地區
    if (role_level >= 99) {
      // 擁有 99 分最高權限，直接撈取所有地區群組
      sql = `SELECT id, name FROM report_groups ORDER BY id ASC`;
    } else {
      // 中階管理員，只撈取該單位被分配的地區
      sql = `
        SELECT rg.id, rg.name 
        FROM report_groups rg
        JOIN unit_allowed_regions uar ON rg.id = uar.region_id
        WHERE uar.unit_id = ?
        ORDER BY rg.id ASC
      `;
      params.push(unit_id);
    }

    const [regions] = await db.query(sql, params);
    res.json({ success: true, data: regions });
  } catch (error) {
    console.error("抓取地區失敗：", error);
    res.status(500).json({ success: false, message: "抓取地區失敗" });
  }
});

// ============================================================================
// 4. POST /api/viewers - 新增人員閱覽權限
// 備註：接收前端傳來的 region_ids 陣列，進行資料庫批次寫入。
// - 寫入的目標欄位為 report_group_id。
// ============================================================================
router.post('/', async (req, res) => {
  // 🌟 接收從前端傳來的 emp_id 和 name
  const { emp_id, name, region_ids, operator_id } = req.body;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 1. 找出操作者 (主管) 的 unit_id
    const [op] = await connection.query('SELECT unit_id FROM users WHERE id = ?', [operator_id]);
    const opUnitId = op.length > 0 ? op[0].unit_id : null;

    // 2. 檢查這位 LDAP 員工是否已經存在於我們的 users 表裡
    const [existingUsers] = await connection.query('SELECT id FROM users WHERE emp_id = ?', [emp_id]);
    let targetUserId;

    if (existingUsers.length > 0) {
      // 情況 A：已經存在 (可能曾經用過前台 APP) -> 拔除前台角色，收編到本單位，給予閱覽者角色(假設ID為3)
      targetUserId = existingUsers[0].id;
if (opUnitId) {
        await connection.query(
          'UPDATE users SET unit_id = ?, front_role_id = NULL, back_role_id = 3, updated_by = ?, updated_at = NOW() WHERE id = ?', 
          [opUnitId, operator_id, targetUserId]
        );
      }
    } else {
      // 情況 B：完全沒在資料庫裡建檔過 -> 自動幫他建立帳號，綁定單位與後台閱覽者角色(假設ID為3)
      const [insertRes] = await connection.query(
        `INSERT INTO users 
          (emp_id, name, unit_id, front_role_id, back_role_id, created_by, created_at) 
         VALUES 
          (?, ?, ?, NULL, 3, ?, NOW())`,
        [emp_id, name, opUnitId, operator_id] // 🌟 依序對應 4 個問號
      );
      targetUserId = insertRes.insertId; // 取得剛剛建立的新流水號 ID
    }

    // 3. 寫入閱覽地區權限 (使用這個確定的 targetUserId)
if (region_ids && region_ids.length > 0) {
      const values = region_ids.map(rid => [targetUserId, rid, operator_id]);
      await connection.query(
        'INSERT INTO user_view_regions (user_id, report_group_id, created_by) VALUES ?',
        [values]
      );
    }

    await connection.commit();
    res.json({ success: true, message: "權限配置成功" });
  } catch (error) {
    await connection.rollback();
    console.error("新增失敗：", error);
    res.status(500).json({ success: false, message: "配置失敗" });
  } finally { 
    connection.release(); 
  }
});
// ============================================================================
// 5. PUT /api/viewers/:userId - 更新人員閱覽權限
// 備註：編輯權限時使用。
// - 採用「先清空舊權限 (DELETE)，再批次寫入新權限 (INSERT)」的作法，確保資料完全同步。
// ============================================================================
router.put('/:userId', async (req, res) => {
  const { userId } = req.params;
  const { region_ids, operator_id } = req.body;
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();

    // 🌟 1. 先查出資料庫裡「原本」有哪些地區
    const [existingRows] = await connection.query(
      'SELECT report_group_id FROM user_view_regions WHERE user_id = ?', 
      [userId]
    );
    const existingIds = existingRows.map(r => r.report_group_id);

    // 🌟 2. 邏輯比對：抓出「要刪除」和「要新增」的陣列
    // 要刪除：原本有，但前端傳來的陣列裡沒有
    const toDelete = existingIds.filter(id => !region_ids.includes(id));
    // 要新增：前端傳來的有，但原本資料庫沒有
    const toAdd = region_ids.filter(id => !existingIds.includes(id));

    // 🌟 3. 執行精準刪除
    if (toDelete.length > 0) {
      await connection.query(
        'DELETE FROM user_view_regions WHERE user_id = ? AND report_group_id IN (?)',
        [userId, toDelete]
      );
    }

    // 🌟 4. 執行精準新增 (只有新勾選的，才會寫入現在的 operator_id)
    if (toAdd.length > 0) {
      const addValues = toAdd.map(rid => [userId, rid, operator_id]);
      await connection.query(
        'INSERT INTO user_view_regions (user_id, report_group_id, created_by) VALUES ?',
        [addValues]
      );
    }

    await connection.commit();
    res.json({ success: true, message: "更新成功" });
  } catch (error) {
    await connection.rollback();
    console.error("更新失敗：", error);
    res.status(500).json({ success: false, message: "更新失敗" });
  } finally { 
    connection.release(); 
  }
});

// ============================================================================
// DELETE /api/viewers/:id - 刪除閱覽權限
// ============================================================================
router.delete('/:id', async (req, res) => {
  const targetUserId = req.params.id;
  const operatorId = req.query.operator_id; 

  if (!operatorId) {
    return res.status(400).json({ success: false, message: '缺少操作者 ID' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 1. 查出操作者 (主管) 的權限等級與單位
    const [opRows] = await connection.query(`
      SELECT u.unit_id, br.role_level 
      FROM users u 
      JOIN back_roles br ON u.back_role_id = br.id 
      WHERE u.id = ?
    `, [operatorId]);

    if (opRows.length === 0) throw new Error("找不到操作者權限");
    const { unit_id, role_level } = opRows[0];

    // 2. 執行地區刪除 (高階全刪，中階只刪自己單位)
    if (role_level >= 99) {
      await connection.query('DELETE FROM user_view_regions WHERE user_id = ?', [targetUserId]);
    } else {
      await connection.query(`
        DELETE FROM user_view_regions 
        WHERE user_id = ? 
          AND report_group_id IN (
            SELECT region_id FROM unit_allowed_regions WHERE unit_id = ?
          )
      `, [targetUserId, unit_id]);
    }

    // 3. 🌟 終極判斷：是否符合「全刪除」條件？
    // 條件 A：檢查他是不是連一個閱覽地區都沒有了？
    const [leftRegions] = await connection.query('SELECT COUNT(*) as count FROM user_view_regions WHERE user_id = ?', [targetUserId]);
    
    if (leftRegions[0].count === 0) {
      // 條件 B：檢查他有沒有「前台角色」？
      const [targetUser] = await connection.query('SELECT front_role_id FROM users WHERE id = ?', [targetUserId]);
      
      if (targetUser.length > 0) {
        const fRole = targetUser[0].front_role_id;
        
        // 如果連前台角色都沒有 (null, 空字串, 或 0)
        if (!fRole || fRole === 0 || fRole === '') {
          // 🚀 觸發全刪除：因為你資料庫有設 CASCADE，砍掉 user 就會清乾淨所有關聯！
          await connection.query('DELETE FROM users WHERE id = ?', [targetUserId]);
        } else {
          // 🛡️ 防護機制：他雖然沒地區了，但「還有前台角色」，不能砍帳號！
          // 只能把他的後台角色設為 0 (無角色)，避免觸發 back_role_id cannot be null 的錯誤
          await connection.query('UPDATE users SET back_role_id = 0 WHERE id = ?', [targetUserId]);
        }
      }
    }

    // 🚨 剛剛被你不小心註解掉的 commit，幫你恢復了！這行沒跑資料是不會存的！
    await connection.commit();
    res.json({ success: true, message: '權限移除成功' });
  } catch (error) {
    await connection.rollback();
    console.error("刪除權限失敗：", error);
    res.status(500).json({ success: false, message: '刪除失敗' });
  } finally {
    connection.release();
  }
});

module.exports = router;