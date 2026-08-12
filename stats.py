from .db import connect

def main():
    con = connect()
    row = con.execute("""
        SELECT COUNT(*) total,
               SUM(CASE WHEN processed=1 THEN 1 ELSE 0 END) processed,
               SUM(CASE WHEN relevant=1 THEN 1 ELSE 0 END) relevant,
               AVG(CASE WHEN relevant=1 THEN importance END) avg_importance
        FROM articles
    """).fetchone()

    print(f"Total articles: {row['total']}")
    print(f"Processed: {row['processed']}")
    print(f"Relevant: {row['relevant']}")
    print(f"Average importance: {row['avg_importance']}")
    con.close()

if __name__ == "__main__":
    main()
