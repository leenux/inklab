// Command fillloc4 upgrades inklab.db with zhCN (*_loc4) columns and fills
// them from the 1.18.1 MariaDB locales_* tables (tw_world).
//
// Missing Chinese is replaced with the English field value so the UI always
// has a loc4 string to show.
//
// Default MariaDB (see .cursor/rules/inklab.mdc):
//
//	mangos:mangos@tcp(127.0.0.1:3306)/tw_world
//
// Override with MYSQL_* env vars or a .env file (same as rebuilddb).
//
// Usage:
//
//	go run ./cmd/fillloc4 [dataDir|dbPath]
//
// dataDir defaults to "data" (uses data/inklab.db). A path ending in .db is
// treated as the SQLite file directly.
package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"inklab/backend/database"
	"inklab/backend/database/importers"

	"github.com/joho/godotenv"
)

func main() {
	target := "data"
	if len(os.Args) > 1 {
		target = os.Args[1]
	}
	dbPath := target
	if !strings.HasSuffix(strings.ToLower(target), ".db") {
		dbPath = filepath.Join(target, "inklab.db")
	}

	_ = godotenv.Load()

	host := envOr("MYSQL_HOST", "127.0.0.1")
	port := envOr("MYSQL_PORT", "3306")
	user := envOr("MYSQL_USER", "mangos")
	pass := envOr("MYSQL_PASSWORD", "mangos")
	name := envOr("MYSQL_DATABASE", "tw_world")
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s", user, pass, host, port, name)

	sqlite, err := database.NewSQLiteDB(dbPath)
	if err != nil {
		fatal("open sqlite", err)
	}
	defer sqlite.Close()
	if err := sqlite.InitSchema(); err != nil {
		fatal("init schema", err)
	}

	mysqlConn, err := database.NewMySQLConnection(dsn)
	if err != nil {
		fatal("mysql connect", err)
	}
	defer mysqlConn.Close()
	fmt.Println("✓ MySQL connected:", dsn)

	fmt.Println("Filling *_loc4 from locales_* ...")
	if err := importers.NewLoc4Importer(sqlite.DB(), mysqlConn.DB()).FillAll(); err != nil {
		fatal("fill loc4", err)
	}
	fmt.Println("✓ Done:", dbPath)
}

func envOr(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func fatal(ctx string, err error) {
	fmt.Fprintf(os.Stderr, "error (%s): %v\n", ctx, err)
	os.Exit(1)
}
