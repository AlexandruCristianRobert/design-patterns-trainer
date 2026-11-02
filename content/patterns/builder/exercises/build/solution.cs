var toys = new QueryBuilder("toys").Select("name").Select("price").Where("price < 20");
Console.WriteLine(toys.Build().ToSql());

Reports.CheapestInStock(toys, 5);
Console.WriteLine(toys.Build().ToSql());

try
{
    new QueryBuilder("toys").Limit(3).Build();
}
catch (InvalidOperationException problem)
{
    Console.WriteLine($"rejected: {problem.Message}");
}

// A finished query. Only QueryBuilder can create one, and nothing can change it afterwards.
public class SqlQuery
{
    private readonly string sql;

    internal SqlQuery(string sql) => this.sql = sql;

    public string ToSql() => sql;
}

// Collects the parts of a query in any order and writes the SQL at Build().
public class QueryBuilder(string table)
{
    private readonly List<string> columns = [];
    private readonly List<string> conditions = [];
    private string? orderBy;
    private int? limit;

    public QueryBuilder Select(string column) { columns.Add(column); return this; }
    public QueryBuilder Where(string condition) { conditions.Add(condition); return this; }
    public QueryBuilder OrderBy(string column) { orderBy = column; return this; }
    public QueryBuilder Limit(int count) { limit = count; return this; }

    public SqlQuery Build()
    {
        if (limit is not null && orderBy is null)
            throw new InvalidOperationException("A limit without an order picks rows at random.");
        if (limit < 1)
            throw new InvalidOperationException("A limit must be at least 1.");

        var sql = $"SELECT {(columns.Count == 0 ? "*" : string.Join(", ", columns))} FROM {table}";
        if (conditions.Count > 0) sql += $" WHERE {string.Join(" AND ", conditions)}";
        if (orderBy is not null) sql += $" ORDER BY {orderBy}";
        if (limit is not null) sql += $" LIMIT {limit}";
        // The SQL is a finished string, so later steps cannot reach into this query.
        return new SqlQuery(sql);
    }
}

// A recipe the reports reuse. It adds its steps to whichever builder it is handed.
public static class Reports
{
    public static void CheapestInStock(QueryBuilder query, int count) =>
        query.Where("stock > 0").OrderBy("price").Limit(count);
}
