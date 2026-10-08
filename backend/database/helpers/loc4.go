package helpers

import "fmt"

// Loc returns a SQL expression that prefers the zhCN column (*_loc4) and
// falls back to the English column. g1 fills empty Chinese with English, so
// the result is never blank when the English field has a value.
//
// alias may be "" for unqualified columns. english is the base column name
// (e.g. "name", "Title", "nameSubtext").
func Loc(alias, english string) string {
	loc4 := english + "_loc4"
	if alias == "" {
		return fmt.Sprintf("COALESCE(NULLIF(%s,''), %s)", loc4, english)
	}
	return fmt.Sprintf("COALESCE(NULLIF(%s.%s,''), %s.%s)", alias, loc4, alias, english)
}

// LocAs is Loc with an AS alias for the selected expression.
func LocAs(tableAlias, english, as string) string {
	return Loc(tableAlias, english) + " AS " + as
}

// skillNameZH maps SkillLine.dbc ids to zhCN display names. spell_skills is
// populated from the (usually English) client DBC and has no locales_* table in
// the 1.18.1 world DB, so CN builds use this overlay at display time.
var skillNameZH = map[int]string{
	// Professions
	164: "锻造", 165: "制皮", 171: "炼金术", 182: "草药学", 186: "采矿",
	197: "裁缝", 202: "工程学", 333: "附魔", 393: "剥皮", 755: "珠宝加工",
	773: "铭文",
	// Secondary
	129: "急救", 142: "生存", 185: "烹饪", 356: "钓鱼", 762: "骑术", 155: "游泳",
	148: "骑马", 149: "骑狼", 150: "骑虎", 152: "骑羊", 533: "骑迅猛龙",
	553: "驾驶机械陆行鸟", 554: "骑骸骨战马", 713: "骑科多兽",
	// Weapon skills (common)
	43: "单手剑", 44: "单手斧", 45: "弓", 46: "枪械", 54: "单手锤",
	55: "双手剑", 136: "法杖", 160: "双手锤", 172: "双手斧",
	173: "匕首", 176: "投掷", 226: "弩", 228: "魔杖", 229: "长柄武器",
	473: "拳套",
	// Class / misc labels often shown in UI
	95: "防御", 98: "语言：通用语", 109: "语言：兽人语",
	162: "徒手战斗", 183: "通用", 415: "布甲", 414: "皮甲", 413: "锁甲", 293: "板甲",
}

// skillCategoryZH maps spell_skill_categories ids.
var skillCategoryZH = map[int]string{
	6: "武器技能", 7: "职业技能", 8: "护甲专精", 9: "辅助技能",
	10: "语言", 11: "专业", 13: "种族特长",
}

// LocalizeSkillName returns the zhCN name for a skill line id, or fallback
// (typically the English DBC name) when no mapping exists.
func LocalizeSkillName(id int, fallback string) string {
	if zh, ok := skillNameZH[id]; ok && zh != "" {
		return zh
	}
	return fallback
}

// LocalizeSkillCategoryName returns the zhCN name for a skill category id.
func LocalizeSkillCategoryName(id int, fallback string) string {
	if zh, ok := skillCategoryZH[id]; ok && zh != "" {
		return zh
	}
	return fallback
}

// talentTabZH maps TalentTab.dbc English names to zhCN (tabs are imported from
// the client DBC / talents.json without a locales table).
var talentTabZH = map[string]string{
	"Fire": "火焰", "Frost": "冰霜", "Arcane": "奥术",
	"Arms": "武器", "Protection": "防护", "Fury": "狂怒",
	"Combat": "战斗", "Assassination": "刺杀", "Subtlety": "敏锐",
	"Discipline": "戒律", "Holy": "神圣", "Shadow": "暗影",
	"Elemental": "元素", "Restoration": "恢复", "Enhancement": "增强",
	"Feral Combat": "野性战斗", "Balance": "平衡",
	"Destruction": "毁灭", "Affliction": "痛苦", "Demonology": "恶魔学识",
	"Beast Mastery": "野兽掌控", "Survival": "生存", "Marksmanship": "射击",
	"Retribution": "惩戒",
}

// classNameZH maps ChrClasses ids to zhCN display names.
var classNameZH = map[int]string{
	1: "战士", 2: "圣骑士", 3: "猎人", 4: "盗贼", 5: "牧师",
	7: "萨满祭司", 8: "法师", 9: "术士", 11: "德鲁伊",
}

// LocalizeTalentTabName returns the zhCN talent-tree name.
func LocalizeTalentTabName(fallback string) string {
	if zh, ok := talentTabZH[fallback]; ok && zh != "" {
		return zh
	}
	return fallback
}

// LocalizeClassName returns the zhCN class display name for a class id.
func LocalizeClassName(id int, fallback string) string {
	if zh, ok := classNameZH[id]; ok && zh != "" {
		return zh
	}
	return fallback
}
