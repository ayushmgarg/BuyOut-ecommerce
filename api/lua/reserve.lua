local inventory_key   = KEYS[1]
local user_key        = KEYS[2]
local reservation_key = KEYS[3]
local quantity        = tonumber(ARGV[1])
local user_id         = ARGV[2]
local reservation_id  = ARGV[3]
local expires_in      = tonumber(ARGV[4])

if redis.call('EXISTS', user_key) == 1 then return 'USER_LIMIT_EXCEEDED' end

local stock = tonumber(redis.call('GET', inventory_key))
if not stock or stock < quantity then return 'OUT_OF_STOCK' end

redis.call('DECRBY', inventory_key, quantity)
redis.call('SET', user_key, 'reserved', 'EX', expires_in)
redis.call('HSET', reservation_key, 'user_id', user_id, 'product_id', ARGV[6], 'status', 'reserved', 'expires_at', ARGV[5])

return 'RESERVED:' .. reservation_id
