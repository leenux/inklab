package importers

import (
	"database/sql"
	"fmt"
	"log"
	"strings"

	"inklab/backend/database/schema"
)

// Loc4Importer fills SQLite *_loc4 (zhCN) columns from the 1.18.1 MariaDB
// locales_* tables. Missing Chinese falls back to the English column value.
type Loc4Importer struct {
	sqliteDB *sql.DB
	mysqlDB  *sql.DB
}

// NewLoc4Importer creates a loc4 filler.
func NewLoc4Importer(sqliteDB, mysqlDB *sql.DB) *Loc4Importer {
	return &Loc4Importer{sqliteDB: sqliteDB, mysqlDB: mysqlDB}
}

// loc4Source describes how to pull Chinese strings from MariaDB for one SQLite table.
type loc4Source struct {
	sqliteTable string
	sqliteKey   string // usually "entry"; factions/taxi_node use "id"
	mysqlTable  string
	mysqlKey    string
	// mysqlLoc4[i] is the MariaDB column for schema.Loc4Tables Columns[i].Loc4
	mysqlLoc4 []string
}

var loc4Sources = []loc4Source{
	{
		sqliteTable: "item_template", sqliteKey: "entry",
		mysqlTable: "locales_item", mysqlKey: "entry",
		mysqlLoc4: []string{"name_loc4", "description_loc4"},
	},
	{
		sqliteTable: "creature_template", sqliteKey: "entry",
		mysqlTable: "locales_creature", mysqlKey: "entry",
		mysqlLoc4: []string{"name_loc4", "subname_loc4"},
	},
	{
		sqliteTable: "quest_template", sqliteKey: "entry",
		mysqlTable: "locales_quest", mysqlKey: "entry",
		mysqlLoc4: []string{
			"Title_loc4", "Details_loc4", "Objectives_loc4",
			"OfferRewardText_loc4", "RequestItemsText_loc4", "EndText_loc4",
			"ObjectiveText1_loc4", "ObjectiveText2_loc4",
			"ObjectiveText3_loc4", "ObjectiveText4_loc4",
		},
	},
	{
		sqliteTable: "spell_template", sqliteKey: "entry",
		mysqlTable: "locales_spell", mysqlKey: "entry",
		mysqlLoc4: []string{
			"name_loc4", "nameSubtext_loc4", "description_loc4", "auraDescription_loc4",
		},
	},
	{
		sqliteTable: "gameobject_template", sqliteKey: "entry",
		mysqlTable: "locales_gameobject", mysqlKey: "entry",
		mysqlLoc4: []string{"name_loc4"},
	},
	{
		sqliteTable: "factions", sqliteKey: "id",
		mysqlTable: "locales_faction", mysqlKey: "entry",
		mysqlLoc4: []string{"name_loc4", "description_loc4"},
	},
	{
		sqliteTable: "taxi_node", sqliteKey: "id",
		mysqlTable: "locales_taxi_node", mysqlKey: "entry",
		mysqlLoc4: []string{"name_loc4"},
	},
}

// FillAll ensures loc4 columns exist, copies English into them, then overlays
// nonempty zhCN strings from MariaDB locales_* tables.
func (i *Loc4Importer) FillAll() error {
	if i.sqliteDB == nil {
		return fmt.Errorf("sqlite connection is nil")
	}
	if i.mysqlDB == nil {
		return fmt.Errorf("mysql connection is nil")
	}

	schema.MigrateLoc4(i.sqliteDB)

	for _, src := range loc4Sources {
		cols := loc4ColumnsFor(src.sqliteTable)
		if cols == nil {
			return fmt.Errorf("no Loc4Tables entry for %s", src.sqliteTable)
		}
		if len(cols) != len(src.mysqlLoc4) {
			return fmt.Errorf("%s: column count mismatch schema=%d mysql=%d",
				src.sqliteTable, len(cols), len(src.mysqlLoc4))
		}

		if err := i.copyEnglishFallback(src.sqliteTable, src.sqliteKey, cols); err != nil {
			return fmt.Errorf("english fallback %s: %w", src.sqliteTable, err)
		}
		n, err := i.applyChinese(src, cols)
		if err != nil {
			return fmt.Errorf("chinese fill %s: %w", src.sqliteTable, err)
		}
		log.Printf("✓ %s: loc4 filled (zh overlay rows=%d)", src.sqliteTable, n)
	}
	return nil
}

func loc4ColumnsFor(table string) []schema.Loc4Column {
	for _, t := range schema.Loc4Tables {
		if t.Table == table {
			return t.Columns
		}
	}
	return nil
}

// copyEnglishFallback sets every *_loc4 from its English twin so missing
// Chinese still displays English (per project locale rules).
func (i *Loc4Importer) copyEnglishFallback(table, key string, cols []schema.Loc4Column) error {
	sets := make([]string, len(cols))
	for j, c := range cols {
		// COALESCE so NULL English becomes '' rather than NULL loc4.
		sets[j] = fmt.Sprintf("%s=COALESCE(%s,'')", c.Loc4, c.English)
	}
	q := fmt.Sprintf("UPDATE %s SET %s", table, strings.Join(sets, ", "))
	_, err := i.sqliteDB.Exec(q)
	return err
}

func (i *Loc4Importer) applyChinese(src loc4Source, cols []schema.Loc4Column) (int, error) {
	selectCols := make([]string, 0, 1+len(src.mysqlLoc4))
	selectCols = append(selectCols, src.mysqlKey)
	selectCols = append(selectCols, src.mysqlLoc4...)

	q := fmt.Sprintf("SELECT %s FROM %s", strings.Join(selectCols, ", "), src.mysqlTable)
	rows, err := i.mysqlDB.Query(q)
	if err != nil {
		return 0, fmt.Errorf("query %s: %w", src.mysqlTable, err)
	}
	defer rows.Close()

	tx, err := i.sqliteDB.Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	updated := 0
	for rows.Next() {
		var key interface{}
		vals := make([]sql.NullString, len(cols))
		scan := make([]interface{}, 1+len(cols))
		scan[0] = &key
		for j := range vals {
			scan[j+1] = &vals[j]
		}
		if err := rows.Scan(scan...); err != nil {
			return updated, fmt.Errorf("scan %s: %w", src.mysqlTable, err)
		}

		// Only overwrite fields that have nonempty Chinese; leave English fallback.
		setParts := make([]string, 0, len(cols))
		args := make([]interface{}, 0, len(cols)+1)
		for j, v := range vals {
			s := strings.TrimSpace(v.String)
			if s == "" {
				continue
			}
			setParts = append(setParts, cols[j].Loc4+"=?")
			args = append(args, s)
		}
		if len(setParts) == 0 {
			continue
		}
		args = append(args, key)
		res, err := tx.Exec(
			fmt.Sprintf("UPDATE %s SET %s WHERE %s=?",
				src.sqliteTable, strings.Join(setParts, ", "), src.sqliteKey),
			args...,
		)
		if err != nil {
			return updated, err
		}
		n, _ := res.RowsAffected()
		if n > 0 {
			updated++
		}
	}
	if err := rows.Err(); err != nil {
		return updated, err
	}
	if err := tx.Commit(); err != nil {
		return updated, err
	}
	return updated, nil
}
