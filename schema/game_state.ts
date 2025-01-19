import {
  pgTable,
  serial,
  timestamp,
  varchar,
  integer,
} from "drizzle-orm/pg-core";

export const gameState = pgTable("game_state", {
  id: serial("id").primaryKey(), // Assuming you want a primary key
  messagesCount: integer("messages_count").notNull().default(0),
  endgameStartTime: timestamp("endgame_start_time"),
  lastMessageTime: timestamp("last_message_time"),
});
