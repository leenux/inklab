package schema

import "database/sql"

// Loc4Column maps an English text column to its zhCN (locale index 4) twin.
type Loc4Column struct {
	English string
	Loc4    string
}

// Loc4Tables lists SQLite tables that gain *_loc4 columns for Chinese text.
// English fallbacks and MySQL locales_* fills are applied by the loc4 importer.
var Loc4Tables = []struct {
	Table   string
	Columns []Loc4Column
}{
	{
		Table: "item_template",
		Columns: []Loc4Column{
			{English: "name", Loc4: "name_loc4"},
			{English: "description", Loc4: "description_loc4"},
		},
	},
	{
		Table: "creature_template",
		Columns: []Loc4Column{
			{English: "name", Loc4: "name_loc4"},
			{English: "subname", Loc4: "subname_loc4"},
		},
	},
	{
		Table: "quest_template",
		Columns: []Loc4Column{
			{English: "Title", Loc4: "Title_loc4"},
			{English: "Details", Loc4: "Details_loc4"},
			{English: "Objectives", Loc4: "Objectives_loc4"},
			{English: "OfferRewardText", Loc4: "OfferRewardText_loc4"},
			{English: "RequestItemsText", Loc4: "RequestItemsText_loc4"},
			{English: "EndText", Loc4: "EndText_loc4"},
			{English: "ObjectiveText1", Loc4: "ObjectiveText1_loc4"},
			{English: "ObjectiveText2", Loc4: "ObjectiveText2_loc4"},
			{English: "ObjectiveText3", Loc4: "ObjectiveText3_loc4"},
			{English: "ObjectiveText4", Loc4: "ObjectiveText4_loc4"},
		},
	},
	{
		Table: "spell_template",
		Columns: []Loc4Column{
			{English: "name", Loc4: "name_loc4"},
			{English: "nameSubtext", Loc4: "nameSubtext_loc4"},
			{English: "description", Loc4: "description_loc4"},
			{English: "auraDescription", Loc4: "auraDescription_loc4"},
		},
	},
	{
		Table: "gameobject_template",
		Columns: []Loc4Column{
			{English: "name", Loc4: "name_loc4"},
		},
	},
	{
		Table: "factions",
		Columns: []Loc4Column{
			{English: "name", Loc4: "name_loc4"},
			{English: "description", Loc4: "description_loc4"},
		},
	},
	{
		Table: "taxi_node",
		Columns: []Loc4Column{
			{English: "name", Loc4: "name_loc4"},
		},
	},
}

// MigrateLoc4 adds zhCN locale columns (*_loc4) to existing SQLite tables.
// Safe to re-run: ALTER failures (column already present) are ignored.
func MigrateLoc4(db *sql.DB) {
	for _, t := range Loc4Tables {
		for _, c := range t.Columns {
			db.Exec("ALTER TABLE " + t.Table + " ADD COLUMN " + c.Loc4 + " TEXT DEFAULT ''")
		}
	}
}
