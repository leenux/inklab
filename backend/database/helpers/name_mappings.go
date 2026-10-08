// Package helpers contains utility functions for database operations
package helpers

import "fmt"

// Client-localized item type-name overrides, populated once at startup from the
// DBC-derived reference tables (item_class_names / item_subclass_names /
// inventory_type_names). When set, the Get* resolvers prefer these over their
// built-in English maps, so type/slot labels follow the client locale. Nil
// until loaded (or when a client import hasn't run) → built-in fallback.
var (
	itemClassNames      map[int]string
	itemSubclassShort   map[[2]int]string // (class,subclass) -> short name ("斧")
	itemSubclassVerbose map[[2]int]string // (class,subclass) -> "One-Handed Axes"
	inventoryTypeNames  map[int]string
	creatureTypeNames   map[int]string    // CreatureType.dbc id -> name
	clientStrings       map[string]string // GlobalStrings key -> localized value
	schoolNames         map[int]string    // spell school index -> name (SPELL_SCHOOLn_CAP)
)

// SetSchoolNames installs client-localized spell-school names (from the
// spell_schools table, sourced from GlobalStrings). Nil/empty → built-in fallback.
func SetSchoolNames(m map[int]string) { schoolNames = m }

// SetCreatureTypeNames installs client-localized creature type names (from
// CreatureType.dbc). CN overlay always wins over English DBC strings.
func SetCreatureTypeNames(m map[int]string) {
	if m == nil {
		m = map[int]string{}
	}
	// CN overlay (matches zhCN CreatureType.dbc). Always wins over English DBC.
	for id, zh := range map[int]string{
		0: "无", 1: "野兽", 2: "龙类", 3: "恶魔", 4: "元素生物", 5: "巨人",
		6: "亡灵", 7: "人型生物", 8: "小动物", 9: "机械", 10: "未指定", 11: "图腾",
	} {
		m[id] = zh
	}
	creatureTypeNames = m
}

// SetClientStrings installs curated GlobalStrings UI values (item quality, bind
// type, spell-trigger prefix, creature rank). Nil/empty → built-in fallback.
func SetClientStrings(m map[string]string) { clientStrings = m }

// clientString returns a loaded GlobalStrings value, or "" when not present.
func clientString(key string) string {
	if clientStrings != nil {
		return clientStrings[key]
	}
	return ""
}

// SetItemNameTables installs the client-localized type-name lookups. Called once
// after the reference tables are imported; safe to call with nil maps (no-op
// override → built-in fallback). Not safe for concurrent use with the getters,
// so call during single-threaded startup before serving requests.
//
// CN builds always overlay zhCN names on top of whatever the (usually English)
// client DBC tables provided, so "Weapon"/"Mace" never leak into the UI.
func SetItemNameTables(class map[int]string, subShort, subVerbose map[[2]int]string, inv map[int]string) {
	if class == nil {
		class = map[int]string{}
	}
	if subShort == nil {
		subShort = map[[2]int]string{}
	}
	if subVerbose == nil {
		subVerbose = map[[2]int]string{}
	}
	if inv == nil {
		inv = map[int]string{}
	}
	for id, zh := range itemClassNamesZH {
		class[id] = zh
	}
	for key, zh := range itemSubclassShortZH {
		subShort[key] = zh
	}
	for key, zh := range itemSubclassVerboseZH {
		subVerbose[key] = zh
	}
	for id, zh := range inventoryTypeNamesZH {
		inv[id] = zh
	}
	itemClassNames = class
	itemSubclassShort = subShort
	itemSubclassVerbose = subVerbose
	inventoryTypeNames = inv
}

// zhCN overlays for ItemClass / ItemSubClass / InventoryType (1.12).
var itemClassNamesZH = map[int]string{
	0: "消耗品", 1: "容器", 2: "武器", 3: "珠宝（过时）", 4: "护甲", 5: "材料",
	6: "弹药", 7: "商品", 8: "通用（已过时）", 9: "配方", 10: "钱（过时）", 11: "箭袋",
	12: "任务", 13: "钥匙", 14: "永久", 15: "其它",
}

var itemSubclassShortZH = map[[2]int]string{
	{0, 0}: "消耗品", {0, 1}: "食物", {0, 2}: "液体",
	{1, 0}: "容器", {1, 1}: "灵魂袋", {1, 2}: "草药袋", {1, 3}: "附魔材料袋",
	{1, 4}: "工程学材料袋", {1, 5}: "宝石袋", {1, 6}: "矿石袋",
	{1, 7}: "制皮材料袋", {1, 8}: "肉类袋", {1, 9}: "钓鱼袋",
	{2, 0}: "斧", {2, 1}: "斧", {2, 2}: "弓", {2, 3}: "枪械",
	{2, 4}: "锤", {2, 5}: "锤", {2, 6}: "长柄武器", {2, 7}: "剑", {2, 8}: "剑",
	{2, 9}: "已废弃", {2, 10}: "法杖", 	{2, 11}: "异种武器", {2, 12}: "异种武器",
	{2, 13}: "拳套", {2, 14}: "其它", {2, 15}: "匕首", {2, 16}: "投掷武器",
	{2, 17}: "矛", {2, 18}: "弩", {2, 19}: "魔杖", {2, 20}: "鱼竿",
	{3, 0}: "宝石",
	{4, 0}: "杂项", {4, 1}: "布甲", {4, 2}: "皮甲", {4, 3}: "锁甲", {4, 4}: "板甲",
	{4, 5}: "小盾", {4, 6}: "盾牌", {4, 7}: "圣契", {4, 8}: "神像", {4, 9}: "图腾",
	{5, 0}: "材料",
	{6, 0}: "魔杖", {6, 1}: "箭矢", {6, 2}: "箭", {6, 3}: "子弹", {6, 4}: "投掷武器",
	{7, 0}: "商品", {7, 1}: "零件", {7, 2}: "爆炸物", {7, 3}: "装置",
	{8, 0}: "通用",
	{9, 0}: "书籍", {9, 1}: "制皮", {9, 2}: "裁缝", {9, 3}: "工程学",
	{9, 4}: "锻造", {9, 5}: "烹饪", {9, 6}: "炼金术", {9, 7}: "急救",
	{9, 8}: "附魔", {9, 9}: "钓鱼", {9, 10}: "珠宝加工", {9, 11}: "生存",
	{10, 0}: "金钱",
	{11, 0}: "箭袋", {11, 1}: "箭袋", {11, 2}: "箭袋", {11, 3}: "弹药袋",
	{12, 0}: "任务",
	{13, 0}: "钥匙", {13, 1}: "开锁器",
	{14, 0}: "永久",
	{15, 0}: "垃圾", {15, 1}: "材料", {15, 2}: "小伙伴", {15, 3}: "节日", {15, 4}: "坐骑",
}

var itemSubclassVerboseZH = map[[2]int]string{
	{2, 0}: "单手斧", {2, 1}: "双手斧", {2, 2}: "弓", {2, 3}: "枪械",
	{2, 4}: "单手锤", {2, 5}: "双手锤", {2, 6}: "长柄武器",
	{2, 7}: "单手剑", {2, 8}: "双手剑", {2, 10}: "法杖",
	{2, 11}: "单手异种武器", {2, 12}: "双手异种武器", {2, 13}: "拳套",
	{2, 15}: "匕首", {2, 16}: "投掷武器", {2, 17}: "矛", {2, 18}: "弩",
	{2, 19}: "魔杖", {2, 20}: "鱼竿",
	{4, 1}: "布甲", {4, 2}: "皮甲", {4, 3}: "锁甲", {4, 4}: "板甲",
	{4, 5}: "小盾", {4, 6}: "盾牌", {4, 7}: "圣契", {4, 8}: "神像", {4, 9}: "图腾",
}

var inventoryTypeNamesZH = map[int]string{
	0: "不可装备", 1: "头部", 2: "颈部", 3: "肩部", 4: "衬衣", 5: "胸部",
	6: "腰部", 7: "腿部", 8: "脚", 9: "手腕", 10: "手", 11: "手指",
	12: "饰品", 13: "单手", 14: "副手", 15: "远程", 16: "背部", 17: "双手",
	18: "背包", 19: "战袍", 20: "胸部", 21: "主手", 22: "副手",
	23: "副手物品", 24: "弹药", 25: "投掷武器", 26: "远程", 27: "箭袋", 28: "圣物",
}

// GetClassName returns the item class name
func GetClassName(c int) string {
	if itemClassNames != nil {
		if n, ok := itemClassNames[c]; ok && n != "" {
			return n
		}
	}
	classNames := map[int]string{
		0:  "消耗品",
		1:  "容器",
		2:  "武器",
		3:  "宝石",
		4:  "护甲",
		5:  "材料",
		6:  "弹药",
		7:  "商品",
		8:  "通用(已废弃)",
		9:  "配方",
		10: "金钱(已废弃)",
		11: "箭袋",
		12: "任务",
		13: "钥匙",
		14: "永久(已废弃)",
		15: "杂项",
	}
	if name, ok := classNames[c]; ok {
		return name
	}
	return "未知"
}

// GetSubClassName returns the item subclass name — the client's short form
// ("剑", "锤"), matching how tooltips/lists pair it with the equip slot
// ("双手" + "剑"), like the game and Wowhead. The 1H/2H distinction
// comes from the slot, not this name. (itemSubclassVerbose holds the long
// "One-/Two-Handed Swords" form for a future standalone filter that lacks slot
// context.) Falls back to built-in names.
func GetSubClassName(c, sc int) string {
	if itemSubclassShort != nil {
		if n, ok := itemSubclassShort[[2]int{c, sc}]; ok && n != "" {
			return n
		}
	}
	// Weapon subclasses (short/family names; the slot carries One-/Two-Hand).
	if c == 2 {
		weaponSubclasses := map[int]string{
			0:  "斧",
			1:  "斧",
			2:  "弓",
			3:  "枪械",
			4:  "锤",
			5:  "锤",
			6:  "长柄武器",
			7:  "剑",
			8:  "剑",
			9:  "已废弃",
			10: "法杖",
			11: "异种武器",
			12: "异种武器",
			13: "拳套",
			14: "杂项",
			15: "匕首",
			16: "投掷武器",
			17: "矛",
			18: "弩",
			19: "魔杖",
			20: "鱼竿",
		}
		if name, ok := weaponSubclasses[sc]; ok {
			return name
		}
	}

	// Armor subclasses
	if c == 4 {
		armorSubclasses := map[int]string{
			0:  "杂项",
			1:  "布甲",
			2:  "皮甲",
			3:  "锁甲",
			4:  "板甲",
			5:  "小盾(已废弃)",
			6:  "盾牌",
			7:  "圣契",
			8:  "神像",
			9:  "图腾",
			10: "魔印",
		}
		if name, ok := armorSubclasses[sc]; ok {
			return name
		}
	}

	// Miscellaneous subclasses: the 1.12 client DBC only names subclass 0 (Junk) —
	// companion pets and mounts predate those item categories, so the client has
	// no name and they'd collapse to "杂项". Provide them, matching the
	// data's layout (subclass 2 = companion pets, 4 = mounts).
	if c == 15 {
		miscSubclasses := map[int]string{
			0: "垃圾",
			1: "材料",
			2: "小伙伴",
			3: "节日",
			4: "坐骑",
		}
		if name, ok := miscSubclasses[sc]; ok {
			return name
		}
	}

	// Other item classes: their subclass names come from the client table
	// (item_subclass_names); pre-import we fall back to the class name rather
	// than maintaining exhaustive hardcoded maps.
	return GetClassName(c)
}

// GetSubClassFamilyName returns the short, family-level subclass name ("剑",
// "斧") rather than the verbose 1H/2H form — for the filter sidebar, which
// groups 1H/2H weapons under one family. Prefers the client's short name.
func GetSubClassFamilyName(c, sc int) string {
	if itemSubclassShort != nil {
		if n, ok := itemSubclassShort[[2]int{c, sc}]; ok && n != "" {
			return n
		}
	}
	return GetSubClassName(c, sc)
}

// GetInventoryTypeName returns the inventory slot name
func GetInventoryTypeName(invType int) string {
	if inventoryTypeNames != nil {
		if n, ok := inventoryTypeNames[invType]; ok && n != "" {
			return n
		}
	}
	invTypeNames := map[int]string{
		0:  "不可装备",
		1:  "头部",
		2:  "颈部",
		3:  "肩部",
		4:  "衬衣",
		5:  "胸部",
		6:  "腰部",
		7:  "腿部",
		8:  "脚",
		9:  "手腕",
		10: "手",
		11: "手指",
		12: "饰品",
		13: "单手",
		14: "盾牌",
		15: "远程",
		16: "背部",
		17: "双手",
		18: "背包",
		19: "战袍",
		20: "长袍",
		21: "主手",
		22: "副手",
		23: "副手物品",
		24: "弹药",
		25: "投掷武器",
		26: "远程",
		27: "箭袋",
		28: "圣物",
	}
	if name, ok := invTypeNames[invType]; ok {
		return name
	}
	return "未知"
}

// bondingKey maps a bonding id to its GlobalStrings key.
var bondingKey = map[int]string{1: "ITEM_BIND_ON_PICKUP", 2: "ITEM_BIND_ON_EQUIP", 3: "ITEM_BIND_ON_USE", 4: "ITEM_BIND_QUEST"}

// GetBondingName returns the bonding type name (client-localized when loaded).
func GetBondingName(bonding int) string {
	if v := clientString(bondingKey[bonding]); v != "" {
		return v
	}
	switch bonding {
	case 1:
		return "拾取后绑定"
	case 2:
		return "装备后绑定"
	case 3:
		return "使用后绑定"
	case 4:
		return "任务物品"
	default:
		return ""
	}
}

// GetQualityName returns the quality name (client-localized when loaded).
func GetQualityName(quality int) string {
	if v := clientString(fmt.Sprintf("ITEM_QUALITY%d_DESC", quality)); v != "" {
		return v
	}
	switch quality {
	case 0:
		return "粗糙"
	case 1:
		return "普通"
	case 2:
		return "优秀"
	case 3:
		return "精良"
	case 4:
		return "史诗"
	case 5:
		return "传说"
	case 6:
		return "神器"
	default:
		return "未知"
	}
}

// GetCreatureTypeName returns the creature type name (client-localized when
// loaded from CreatureType.dbc).
func GetCreatureTypeName(t int) string {
	if creatureTypeNames != nil {
		if n, ok := creatureTypeNames[t]; ok && n != "" {
			return n
		}
	}
	typeNames := map[int]string{
		0:  "无",
		1:  "野兽",
		2:  "龙类",
		3:  "恶魔",
		4:  "元素生物",
		5:  "巨人",
		6:  "亡灵",
		7:  "人型生物",
		8:  "小动物",
		9:  "机械",
		10: "未指定",
		11: "图腾",
	}
	if name, ok := typeNames[t]; ok {
		return name
	}
	return "未知"
}

// GetCreatureRankName returns the creature rank name. "Elite"/"Boss" come from
// the client (ELITE/BOSS GlobalStrings) when loaded; the composite ranks
// ("Rare Elite") and "Normal"/"精良" have no clean client string, so they keep
// a minimal built-in fallback.
func GetCreatureRankName(r int) string {
	elite := clientString("ELITE")
	if elite == "" {
		elite = "精英"
	}
	boss := clientString("BOSS")
	if boss == "" {
		boss = "首领"
	}
	switch r {
	case 1:
		return elite
	case 2:
		return "稀有" + elite
	case 3:
		return boss
	case 4:
		return "精良"
	default:
		return "普通"
	}
}

// triggerKey maps a spell-trigger id to its GlobalStrings prefix key (the three
// the client defines). Other triggers keep a built-in fallback below.
var triggerKey = map[int]string{0: "ITEM_SPELL_TRIGGER_ONUSE", 1: "ITEM_SPELL_TRIGGER_ONEQUIP", 2: "ITEM_SPELL_TRIGGER_ONPROC"}

// GetTriggerPrefix returns the spell trigger prefix (client-localized when
// loaded for Use/Equip/Chance-on-hit).
func GetTriggerPrefix(trigger int) string {
	if v := clientString(triggerKey[trigger]); v != "" {
		return v + " "
	}
	switch trigger {
	case 0:
		return "使用："
	case 1:
		return "装备："
	case 2:
		return "击中时可能："
	case 4:
		return "灵魂石："
	case 5:
		return "使用：（无冷却）"
	case 6:
		return "学习："
	default:
		return ""
	}
}

// StatNames is the canonical item stat_type -> display name map (the ITEM_MOD
// enum). It's the single source of truth for stat names across the app: the
// stat_types table is seeded from it, then the base stats (Strength, Agility,
// Stamina, Intellect, Spirit) are overlaid with the client's localized names at
// import time. The secondary/rating stats (12+) have no string in the 1.12
// client, so their English names live here and stay built-in.
var StatNames = map[int]string{
	0: "法力", 1: "生命", 3: "敏捷", 4: "力量",
	5: "智力", 6: "精神", 7: "耐力",
	12: "防御等级", 13: "躲闪等级", 14: "招架等级",
	15: "格挡等级", 16: "近战命中等级", 17: "远程命中等级",
	18: "法术命中等级", 19: "近战暴击等级", 20: "远程暴击等级",
	21: "法术暴击等级", 35: "韧性等级", 36: "急速等级",
	37: "精准等级", 38: "攻击强度", 39: "远程攻击强度",
	41: "法术治疗", 42: "法术伤害", 43: "法力恢复",
	44: "护甲穿透等级", 45: "法术强度",
}

// GetStatName returns the canonical (built-in English) name for a stat_type id,
// or "" if unknown. Runtime callers should prefer the stat_types table (which
// may carry localized base-stat names); this is the fallback/seed source.
func GetStatName(statType int) string {
	return StatNames[statType]
}

// DecodeSpellAttributes turns the spell_template attribute bitfields into a list
// of human labels using the server-source flag table (SpellAttrFlags). fields is
// indexed: 0=attributes, 1=attributesEx .. 4=attributesEx4, 5=customFlags.
func DecodeSpellAttributes(fields [6]uint32) []string {
	var out []string
	for _, f := range SpellAttrFlags {
		if f.Field < len(fields) && fields[f.Field]&f.Mask != 0 {
			out = append(out, f.Name)
		}
	}
	return out
}

// Faction group masks from FactionTemplate.dbc (FACTION_MASK_*).
const (
	FactionMaskPlayer   = 1
	FactionMaskAlliance = 2
	FactionMaskHorde    = 4
	FactionMaskMonster  = 8
)

// GetFactionReaction derives an NPC's reaction toward a player faction group
// (target = FactionMaskAlliance or FactionMaskHorde) from its FactionTemplate
// group masks. Enemy takes precedence over friend; an NPC in the target's own
// group counts as friendly.
//
// Players always belong to FACTION_MASK_PLAYER as well as Alliance/Horde, so
// templates that only flag the Player bit (enemy_mask=1 / friend_mask=1) —
// typical for Monster vs Friendly-to-all NPCs — must apply to both factions.
func GetFactionReaction(ourMask, friendMask, enemyMask, target int) string {
	switch {
	case enemyMask&target != 0 || enemyMask&FactionMaskPlayer != 0:
		return "敌对"
	case friendMask&target != 0 || friendMask&FactionMaskPlayer != 0:
		return "友好"
	case ourMask&target != 0:
		return "友好"
	default:
		return "中立"
	}
}

// GetSchoolName returns the magic school name (client-localized from
// spell_schools when loaded; built-in English otherwise).
func GetSchoolName(school int) string {
	if schoolNames != nil {
		if n, ok := schoolNames[school]; ok && n != "" {
			return n
		}
	}
	switch school {
	case 0:
		return "物理"
	case 1:
		return "神圣"
	case 2:
		return "火焰"
	case 3:
		return "自然"
	case 4:
		return "冰霜"
	case 5:
		return "暗影"
	case 6:
		return "奥术"
	default:
		return "物理"
	}
}
