use mongodb::Database;
use sqlx::PgPool;

#[derive(Clone)]
pub struct AppState {
    pub pg: Option<PgPool>,
    pub mongo: Option<Database>,
}

impl AppState {
    pub fn new(pg: Option<PgPool>, mongo: Option<Database>) -> Self {
        Self { pg, mongo }
    }
}
