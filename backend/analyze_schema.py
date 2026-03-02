#!/usr/bin/env python3
"""
Standalone script to analyze PostgreSQL database schema.
Connects to the database and extracts comprehensive schema information
including tables, columns, data types, constraints, foreign keys, and indexes.
Outputs JSON that can be consumed by a frontend application.
"""

import os
import json
import sys
from typing import Dict, List, Any, Optional
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor


def load_database_config() -> Dict[str, str]:
    """Load database configuration from environment variables."""
    load_dotenv()
    
    config = {
        'host': os.getenv('DB_HOST', ''),
        'port': os.getenv('DB_PORT', '5432'),
        'database': os.getenv('DB_NAME', ''),
        'user': os.getenv('DB_USER', ''),
        'password': os.getenv('DB_PASSWORD', ''),
    }
    
    # Validate required fields
    required_fields = ['host', 'database', 'user', 'password']
    missing = [field for field in required_fields if not config[field]]
    
    if missing:
        raise ValueError(f"Missing required database configuration: {', '.join(missing)}")
    
    return config


def connect_to_database(config: Dict[str, str]):
    """Establish connection to PostgreSQL database."""
    try:
        conn = psycopg2.connect(
            host=config['host'],
            port=config['port'],
            database=config['database'],
            user=config['user'],
            password=config['password'],
            connect_timeout=10
        )
        return conn
    except psycopg2.Error as e:
        raise ConnectionError(f"Failed to connect to database: {e}")


def get_all_tables(conn) -> List[str]:
    """Get list of all user-defined tables in the database."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        """)
        return [row[0] for row in cur.fetchall()]


def get_table_columns(conn, table_name: str) -> List[Dict[str, Any]]:
    """Get detailed column information for a table."""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT
                c.column_name,
                c.data_type,
                c.udt_name,
                c.character_maximum_length,
                c.numeric_precision,
                c.numeric_scale,
                c.is_nullable,
                c.column_default,
                c.ordinal_position
            FROM information_schema.columns c
            WHERE c.table_schema = 'public'
            AND c.table_name = %s
            ORDER BY c.ordinal_position;
        """, (table_name,))
        
        columns = []
        for row in cur.fetchall():
            col_info = dict(row)
            # Convert to more readable format
            columns.append({
                'name': col_info['column_name'],
                'data_type': col_info['data_type'],
                'udt_name': col_info['udt_name'],
                'max_length': col_info['character_maximum_length'],
                'numeric_precision': col_info['numeric_precision'],
                'numeric_scale': col_info['numeric_scale'],
                'nullable': col_info['is_nullable'] == 'YES',
                'default': col_info['column_default'],
                'position': col_info['ordinal_position']
            })
        
        return columns


def get_primary_keys(conn, table_name: str) -> List[str]:
    """Get primary key columns for a table."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT a.attname
            FROM pg_index i
            JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
            WHERE i.indrelid = %s::regclass
            AND i.indisprimary;
        """, (table_name,))
        return [row[0] for row in cur.fetchall()]


def get_foreign_keys(conn, table_name: str) -> List[Dict[str, Any]]:
    """Get foreign key relationships for a table."""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT
                tc.constraint_name,
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
                AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_name = %s
            AND tc.table_schema = 'public';
        """, (table_name,))
        
        fks = []
        for row in cur.fetchall():
            fk_info = dict(row)
            fks.append({
                'constraint_name': fk_info['constraint_name'],
                'column': fk_info['column_name'],
                'references_table': fk_info['foreign_table_name'],
                'references_column': fk_info['foreign_column_name']
            })
        
        return fks


def get_unique_constraints(conn, table_name: str) -> List[Dict[str, Any]]:
    """Get unique constraints for a table."""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT
                tc.constraint_name,
                array_agg(kcu.column_name ORDER BY kcu.ordinal_position) AS columns
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            WHERE tc.constraint_type = 'UNIQUE'
            AND tc.table_name = %s
            AND tc.table_schema = 'public'
            GROUP BY tc.constraint_name;
        """, (table_name,))
        
        constraints = []
        for row in cur.fetchall():
            constraint_info = dict(row)
            constraints.append({
                'constraint_name': constraint_info['constraint_name'],
                'columns': constraint_info['columns']
            })
        
        return constraints


def get_indexes(conn, table_name: str) -> List[Dict[str, Any]]:
    """Get indexes for a table."""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT
                i.relname AS index_name,
                a.attname AS column_name,
                ix.indisunique AS is_unique,
                ix.indisprimary AS is_primary
            FROM pg_class t
            JOIN pg_index ix ON t.oid = ix.indrelid
            JOIN pg_class i ON i.oid = ix.indexrelid
            JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
            WHERE t.relkind = 'r'
            AND t.relname = %s
            AND NOT ix.indisprimary
            ORDER BY i.relname, a.attnum;
        """, (table_name,))
        
        indexes = {}
        for row in cur.fetchall():
            idx_info = dict(row)
            idx_name = idx_info['index_name']
            
            if idx_name not in indexes:
                indexes[idx_name] = {
                    'name': idx_name,
                    'columns': [],
                    'unique': idx_info['is_unique']
                }
            
            indexes[idx_name]['columns'].append(idx_info['column_name'])
        
        return list(indexes.values())


def get_table_row_count(conn, table_name: str) -> int:
    """Get approximate row count for a table."""
    try:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) FROM {table_name};")
            return cur.fetchone()[0]
    except:
        return 0


def analyze_table(conn, table_name: str) -> Dict[str, Any]:
    """Analyze a single table and return comprehensive schema information."""
    print(f"Analyzing table: {table_name}", file=sys.stderr)
    
    columns = get_table_columns(conn, table_name)
    primary_keys = get_primary_keys(conn, table_name)
    foreign_keys = get_foreign_keys(conn, table_name)
    unique_constraints = get_unique_constraints(conn, table_name)
    indexes = get_indexes(conn, table_name)
    row_count = get_table_row_count(conn, table_name)
    
    # Mark primary key columns
    for col in columns:
        col['is_primary_key'] = col['name'] in primary_keys
    
    # Mark foreign key columns
    fk_columns = {fk['column'] for fk in foreign_keys}
    for col in columns:
        col['is_foreign_key'] = col['name'] in fk_columns
    
    return {
        'name': table_name,
        'columns': columns,
        'primary_keys': primary_keys,
        'foreign_keys': foreign_keys,
        'unique_constraints': unique_constraints,
        'indexes': indexes,
        'row_count': row_count
    }


def analyze_database() -> Dict[str, Any]:
    """Analyze the entire database schema."""
    config = load_database_config()
    conn = connect_to_database(config)
    
    try:
        tables = get_all_tables(conn)
        
        schema_info = {
            'database_name': config['database'],
            'database_host': config['host'],
            'tables': []
        }
        
        for table_name in tables:
            table_info = analyze_table(conn, table_name)
            schema_info['tables'].append(table_info)
        
        return schema_info
    
    finally:
        conn.close()


def main():
    """Main entry point."""
    try:
        schema_info = analyze_database()
        
        # Output as JSON
        print(json.dumps(schema_info, indent=2))
        
    except Exception as e:
        print(json.dumps({
            'error': str(e),
            'error_type': type(e).__name__
        }), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()

