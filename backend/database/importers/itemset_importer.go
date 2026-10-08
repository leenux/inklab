package importers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"os"

	"inklab/backend/database/models"
)

// ItemSetImporter handles item set data imports
type ItemSetImporter struct {
	db *sql.DB
}

// NewItemSetImporter creates a new item set importer
func NewItemSetImporter(db *sql.DB) *ItemSetImporter {
	return &ItemSetImporter{db: db}
}

// ImportFromJSON imports item sets from JSON
func (i *ItemSetImporter) ImportFromJSON(jsonPath string) error {
	file, err := os.Open(jsonPath)
	if err != nil {
		return fmt.Errorf("failed to open item sets JSON: %w", err)
	}
	defer file.Close()

	var sets []models.ItemSetEntry
	if err := json.NewDecoder(file).Decode(&sets); err != nil {
		return fmt.Errorf("failed to decode item sets JSON: %w", err)
	}

	tx, err := i.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Upsert DBC fields. name_loc4 from a CN ItemSet.dbc overwrites; otherwise
	// keep any existing Chinese name when the import only has English.
	stmt, err := tx.Prepare(`
		INSERT INTO itemsets (
			itemset_id, name, name_loc4,
			item1, item2, item3, item4, item5, item6, item7, item8, item9, item10,
			skill_id, skill_level,
			bonus1, bonus2, bonus3, bonus4, bonus5, bonus6, bonus7, bonus8,
			spell1, spell2, spell3, spell4, spell5, spell6, spell7, spell8
		) VALUES (
			?, ?, ?,
			?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
			?, ?,
			?, ?, ?, ?, ?, ?, ?, ?,
			?, ?, ?, ?, ?, ?, ?, ?
		)
		ON CONFLICT(itemset_id) DO UPDATE SET
			name=excluded.name,
			name_loc4=CASE
				WHEN excluded.name_loc4 != '' AND excluded.name_loc4 != excluded.name
					THEN excluded.name_loc4
				WHEN itemsets.name_loc4 != '' THEN itemsets.name_loc4
				ELSE excluded.name_loc4
			END,
			item1=excluded.item1, item2=excluded.item2, item3=excluded.item3,
			item4=excluded.item4, item5=excluded.item5, item6=excluded.item6,
			item7=excluded.item7, item8=excluded.item8, item9=excluded.item9,
			item10=excluded.item10,
			skill_id=excluded.skill_id, skill_level=excluded.skill_level,
			bonus1=excluded.bonus1, bonus2=excluded.bonus2, bonus3=excluded.bonus3,
			bonus4=excluded.bonus4, bonus5=excluded.bonus5, bonus6=excluded.bonus6,
			bonus7=excluded.bonus7, bonus8=excluded.bonus8,
			spell1=excluded.spell1, spell2=excluded.spell2, spell3=excluded.spell3,
			spell4=excluded.spell4, spell5=excluded.spell5, spell6=excluded.spell6,
			spell7=excluded.spell7, spell8=excluded.spell8
	`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, s := range sets {
		loc4 := s.NameLoc4
		if loc4 == "" {
			loc4 = s.Name
		}
		stmt.Exec(
			s.ID, s.Name, loc4,
			s.Item1, s.Item2, s.Item3, s.Item4, s.Item5, s.Item6, s.Item7, s.Item8, s.Item9, s.Item10,
			s.SkillID, s.SkillLevel,
			s.Bonus1, s.Bonus2, s.Bonus3, s.Bonus4, s.Bonus5, s.Bonus6, s.Bonus7, s.Bonus8,
			s.Spell1, s.Spell2, s.Spell3, s.Spell4, s.Spell5, s.Spell6, s.Spell7, s.Spell8,
		)
	}
	return tx.Commit()
}

// CheckAndImport checks if itemsets table is empty and imports if JSON exists
func (i *ItemSetImporter) CheckAndImport(dataDir string) error {
	var count int
	if err := i.db.QueryRow("SELECT COUNT(*) FROM itemsets").Scan(&count); err != nil {
		return nil
	}
	if count == 0 {
		path := fmt.Sprintf("%s/item_sets.json", dataDir)
		if _, err := os.Stat(path); err == nil {
			fmt.Println("Importing Item Sets...")
			return i.ImportFromJSON(path)
		}
	}
	return nil
}
