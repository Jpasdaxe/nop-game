Citizen.CreateThread(function()
    while true do
        Wait(0)
        NetworkSetFriendlyFireOption(true)
        SetCanAttackFriendly(PlayerPedId(), true, false)
    end
end)