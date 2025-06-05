oooOO`

// Based on GlitchCanary Map and Isometric Images


# BASEHREF: media/mudslidemines/
# IMAGE: 6E992CE5-A92F-45EE-A94C-9336B63513DE.png



// Start the player at the crash site

-> Crash_Site_Clearing

=== Crash_Site_Clearing ===


You stand amidst the wreckage of a small plane in a jungle clearing. Moss covers twisted metal. Paths lead into the dense foliage.
+ [Follow the overgrown trail] -> Overgrown_Path
+ [Enter the dark cave mouth] -> Dark_Cave

=== Overgrown_Path ===
# IMAGE: 288390B8-E588-4CDE-AFA7-7612F0F9DF91.png
This path is narrow, crowded by large leaves and thick vines. You can barely see the way forward through the jungle labyrinth.
+ [Push back through the foliage] -> Crash_Site_Clearing
+ [Venture toward the stone ruins] -> Snake_Pit
+ [Descend the mossy steps] -> Control_Room

=== Snake_Pit ===
# IMAGE: B266C9A3-9402-4622-962E-129F6921D855.png
You enter a low-walled area built from stone blocks. Several large, golden snakes slither across the floor, their scales gleaming in the dappled light.
+ [Carefully back away through the vines] -> Overgrown_Path
+ [Edge around the snakes toward the ancient tree] -> Ancient_Grove

=== Dark_Cave ===
# IMAGE: 8A85D856-4662-4425-ABFB-5F7A2F3DBF36.png
The air grows cool and damp as you step into a dark cave entrance. Water drips somewhere within, echoing off unseen walls.
+ [Return to the sunlit clearing] -> Crash_Site_Clearing
+ [Follow the sound of rushing water] -> Waterfall_Base

=== Control_Room ===
# IMAGE: 596A5299-AA05-443E-B7D3-EEEB3D8B5EAA.png
This stone chamber houses a strange, humming pedestal topped with a glowing orb. Ancient markings cover the walls. A heavy red door blocks the passage deeper into the ruins.
// Add logic later for the button/pedestal and Red Door
+ [Climb back up to the jungle path] -> Overgrown_Path
+ [Pass through the mysterious red door] -> River_Ledge // For now, assume the door opens or is bypassed

=== Ancient_Grove ===
# IMAGE: 6055F905-B41A-4D17-80F9-76F45CC522C3.png
An ancient, gnarled tree dominates this quiet grove. Blue, shimmering locks block doorways to the sides. A large snake rests coiled near the tree's base, watching you with golden eyes.
// Add logic later for blue locks
+ [Retreat back to the stone ruins] -> Snake_Pit
+ [Follow the hidden path behind the waterfall] -> Hidden_Shrine

=== Waterfall_Base ===
# IMAGE: 237A2C79-5EDE-407D-A699-B0A3CF1C4567.png
Water cascades down a mossy cliff face into a wide, shallow pool. The spray is refreshing and the mist creates dancing rainbows in the filtered sunlight.
+ [Wade back through the cave passages] -> Dark_Cave

=== River_Ledge ===
# IMAGE: EA969AD0-24EE-4A5D-99F1-3A576217C355.png
You emerge onto a narrow stone ledge overlooking a wide, flowing river below. The current rushes past with hypnotic power, and the ledge extends along the cliff face.
+ [Return through the red door] -> Control_Room
+ [Edge carefully along the cliff] -> River_Crossing

=== Hidden_Shrine ===
# IMAGE: 3E17DDFA-7CA2-44B3-A852-A6A64C0A44BB.png
Tucked away behind foliage is a small, weathered stone shrine beside a gentle cascade of water. Tiny lights like fireflies drift in the air, creating an otherworldly atmosphere.
+ [Return to the ancient tree] -> Ancient_Grove

=== River_Crossing ===
# IMAGE: EA969AD0-24EE-4A5D-99F1-3A576217C355.png
Rough-hewn logs form a precarious bridge across the flowing river. They look slippery and the water rushes dangerously below.
+ [Retreat back along the ledge] -> River_Ledge
+ [Risk crossing the treacherous log bridge] -> Far_Shore

=== Far_Shore ===
# IMAGE: E4C85ECB-2AD7-4AE4-9B36-1C8271E3D503.png
You made it across the river! This shore is rocky and damp. You see an ornate stone entranceway carved with mysterious symbols leading deeper into the ruins.
+ [Cross back over the dangerous bridge] -> River_Crossing
+ [Enter the carved stone archway] -> Ancient_Vault

=== Ancient_Vault ===
# IMAGE: 12E67B94-4352-4F5F-BCA7-0DB27A471ED9.png
Success! This chamber glitters with heaps of gold coins and large, cut gems. Two imposing chests stand against the far wall, locked with red symbols. The treasure sparkles in the mysterious light filtering through cracks in the ancient stone.
// Add logic later for chests
+ [Exit through the stone archway] -> Far_Shore
+ [Admire the treasure]
    It's an incredible sight! The wealth of a lost civilization lies before you. -> Ancient_Vault // Stay in the room

`
