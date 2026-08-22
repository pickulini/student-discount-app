package postgres

import (
    "github.com/jackc/pgx/v5"
    "context"
    "your-project/internal/domain"
    "your-project/internal/repository"
)

type LedgerRepo struct {
    db *DB
}

func NewLedgerRepo(db *DB) repository.LedgerRepository {
    return &LedgerRepo{db: db}
}

func (r *LedgerRepo) CreateTransaction(ctx context.Context, tx *domain.LedgerTransaction) error {
    query := `INSERT INTO ledger_transactions (type, status, idempotency_key, reference_type, reference_id, description) 
              VALUES ($1, $2, $3, $4, $5, $6) 
              RETURNING id, created_at`
    err := r.db.Pool.QueryRow(ctx, query,
        tx.Type, tx.Status, tx.IdempotencyKey, tx.ReferenceType, tx.ReferenceID, tx.Description,
    ).Scan(&tx.ID, &tx.CreatedAt)
    return err
}

func (r *LedgerRepo) CreateEntry(ctx context.Context, entry *domain.LedgerEntry) error {
    query := `INSERT INTO ledger_entries (transaction_id, account_id, amount) 
              VALUES ($1, $2, $3) 
              RETURNING id, created_at`
    err := r.db.Pool.QueryRow(ctx, query,
        entry.TransactionID, entry.AccountID, entry.Amount,
    ).Scan(&entry.ID, &entry.CreatedAt)
    return err
}

func (r *LedgerRepo) UpdateTransactionStatus(ctx context.Context, id int64, status string) error {
    query := `UPDATE ledger_transactions SET status = $1, completed_at = NOW() WHERE id = $2`
    _, err := r.db.Pool.Exec(ctx, query, status, id)
    return err
}

func (r *LedgerRepo) GetTransactionsByUserID(ctx context.Context, userID int64, limit, offset int) ([]domain.TransactionHistory, error) {
    // Объединяем операции из ledger_entries (через ledger_transactions) и bonus_transactions
    query := `
        SELECT 
            COALESCE(lt.id, bt.id) as id,
            CASE 
                WHEN lt.id IS NOT NULL THEN lt.type 
                ELSE bt.type 
            END as type,
            CASE 
                WHEN lt.id IS NOT NULL THEN le.amount 
                ELSE bt.amount 
            END as amount,
            CASE 
                WHEN lt.id IS NOT NULL THEN lt.description 
                ELSE 'Бонусная операция' 
            END as description,
            CASE 
                WHEN lt.id IS NOT NULL THEN lt.status 
                ELSE 'completed' 
            END as status,
            CASE 
                WHEN lt.id IS NOT NULL THEN lt.created_at 
                ELSE bt.created_at 
            END as created_at
        FROM (
            SELECT l.id, l.type, l.status, l.description, l.created_at, le.amount, le.account_id
            FROM ledger_transactions l
            JOIN ledger_entries le ON l.id = le.transaction_id
            JOIN accounts a ON le.account_id = a.id
            WHERE a.user_id = $1
        ) lt
        FULL OUTER JOIN (
            SELECT id, user_id, amount, type, created_at
            FROM bonus_transactions
            WHERE user_id = $1
        ) bt ON false  -- не объединяем, просто объединяем через UNION
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
    `
    // Такой запрос не совсем корректен, потому что FULL OUTER JOIN без условия даст декартово произведение.
    // Лучше использовать UNION ALL.
    // Перепишем с использованием UNION ALL.
    query = `
        SELECT id, type, amount, description, status, created_at FROM (
            SELECT 
                lt.id,
                lt.type,
                le.amount,
                lt.description,
                lt.status,
                lt.created_at
            FROM ledger_transactions lt
            JOIN ledger_entries le ON lt.id = le.transaction_id
            JOIN accounts a ON le.account_id = a.id
            WHERE a.user_id = $1
            UNION ALL
            SELECT 
                bt.id,
                bt.type,
                bt.amount,
                'Бонусная операция' as description,
                'completed' as status,
                bt.created_at
            FROM bonus_transactions bt
            WHERE bt.user_id = $1
        ) t
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
    `
    rows, err := r.db.Pool.Query(ctx, query, userID, limit, offset)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    var transactions []domain.TransactionHistory
    for rows.Next() {
        var t domain.TransactionHistory
        if err := rows.Scan(&t.ID, &t.Type, &t.Amount, &t.Description, &t.Status, &t.CreatedAt); err != nil {
            return nil, err
        }
        transactions = append(transactions, t)
    }
    return transactions, nil
}

func (r *LedgerRepo) CreateTransactionTx(ctx context.Context, tx pgx.Tx, txObj *domain.LedgerTransaction) error {
    query := `INSERT INTO ledger_transactions (type, status, idempotency_key, reference_type, reference_id, description) 
              VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at`
    err := tx.QueryRow(ctx, query,
        txObj.Type, txObj.Status, txObj.IdempotencyKey, txObj.ReferenceType, txObj.ReferenceID, txObj.Description,
    ).Scan(&txObj.ID, &txObj.CreatedAt)
    return err
}

func (r *LedgerRepo) CreateEntryTx(ctx context.Context, tx pgx.Tx, entry *domain.LedgerEntry) error {
    query := `INSERT INTO ledger_entries (transaction_id, account_id, amount) VALUES ($1, $2, $3) RETURNING id, created_at`
    err := tx.QueryRow(ctx, query, entry.TransactionID, entry.AccountID, entry.Amount).Scan(&entry.ID, &entry.CreatedAt)
    return err
}

func (r *LedgerRepo) UpdateTransactionStatusTx(ctx context.Context, tx pgx.Tx, id int64, status string) error {
    query := `UPDATE ledger_transactions SET status = $1, completed_at = NOW() WHERE id = $2`
    _, err := tx.Exec(ctx, query, status, id)
    return err
}
