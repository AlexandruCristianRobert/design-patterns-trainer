public interface IObserver { void Notify(); }
public class Bell : IObserver { int n; public void Notify() => n++; public int Rings() => n; }
