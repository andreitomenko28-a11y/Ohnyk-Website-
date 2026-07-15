import DishCard from './DishCard.jsx';

// Renders a cook's menu grouped by category.
export default function Menu({ menu = [], onConflict }) {
  return (
    <div className="space-y-6">
      {menu.map((group) => (
        <div key={group.category.slug}>
          <div className="mb-3 font-display text-[16px] font-bold">{group.category.name}</div>
          <div className="space-y-3">
            {group.dishes.map((dish) => (
              <DishCard key={dish.id} dish={dish} onConflict={onConflict} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
