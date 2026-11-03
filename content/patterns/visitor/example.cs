// Each report is a visitor. It walks the inventory and adds up one thing, and the items never change.
var inventory = new List<IInventoryItem>
{
    new Furniture("Sofa", 40, 800),
    new Box("Books", 12, 150),
    new Appliance("Fridge", 60, 500),
};

var cost = new MovingCostReport();
var insurance = new InsuranceReport();
foreach (var item in inventory)
{
    item.Accept(cost);
    item.Accept(insurance);
}
Console.WriteLine($"Moving cost: {cost.Total} EUR");
Console.WriteLine($"Insurance value: {insurance.Total} EUR");

public interface IInventoryItem
{
    void Accept(IItemVisitor visitor);
}

public interface IItemVisitor
{
    void Visit(Furniture furniture);
    void Visit(Box box);
    void Visit(Appliance appliance);
}

public class Furniture(string name, int kg, int value) : IInventoryItem
{
    public string Name { get; } = name;
    public int Kg { get; } = kg;
    public int Value { get; } = value;

    // Double dispatch: this class knows its own type, so it picks the Visit(Furniture) overload.
    public void Accept(IItemVisitor visitor) => visitor.Visit(this);
}

public class Box(string name, int kg, int value) : IInventoryItem
{
    public string Name { get; } = name;
    public int Kg { get; } = kg;
    public int Value { get; } = value;

    public void Accept(IItemVisitor visitor) => visitor.Visit(this);
}

public class Appliance(string name, int kg, int value) : IInventoryItem
{
    public string Name { get; } = name;
    public int Kg { get; } = kg;
    public int Value { get; } = value;

    public void Accept(IItemVisitor visitor) => visitor.Visit(this);
}

public class MovingCostReport : IItemVisitor
{
    public int Total { get; private set; }

    public void Visit(Furniture furniture) => Total += furniture.Kg * 3;
    public void Visit(Box box) => Total += box.Kg;
    public void Visit(Appliance appliance) => Total += appliance.Kg * 2 + 30;
}

public class InsuranceReport : IItemVisitor
{
    public int Total { get; private set; }

    public void Visit(Furniture furniture) => Total += furniture.Value;
    public void Visit(Box box) => Total += box.Value;
    public void Visit(Appliance appliance) => Total += appliance.Value * 4 / 5;
}
