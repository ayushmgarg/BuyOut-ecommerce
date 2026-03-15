local inventory_key   = KEYS[1]
local user_key        = KEYS[2]
local reservation_key = KEYS[3]
local quantity        = tonumber(ARGV[1])

local status = redis.call('HGET', reservation_key, 'status')
if not status or status ~= 'reserved' then return 'ALREADY_RELEASED' end

redis.call('INCRBY', inventory_key, quantity)
redis.call('DEL', user_key)
redis.call('HSET', reservation_key, 'status', 'released')

return 'RELEASED'
