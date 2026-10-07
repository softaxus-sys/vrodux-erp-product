/**
 * Sample menu offered from the import dialog — a ready-made, photographed menu for demos and a
 * worked example of the file layout. Photos are Wikimedia Commons images (free licences, mostly
 * CC BY-SA), fetched by the browser at import time; nothing is bundled.
 * Prices are plain numbers and are read in the workspace's own currency.
 */
export interface SampleMenuRow {
  category: string; categoryDescription: string; name: string; description: string;
  price: number; prepTimeMinutes: number; allergens: string; imageUrl: string;
}

export const SAMPLE_MENU: SampleMenuRow[] = [
  {
    "category": "Starters & Chaat",
    "categoryDescription": "Small plates, street-food classics and crispy bites to open the table.",
    "name": "Aloo Samosa (2 pcs)",
    "description": "Golden, flaky pastry filled with spiced potato and green peas, served with imli chutney.",
    "price": 180,
    "prepTimeMinutes": 8,
    "allergens": "Gluten",
    "imageUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c4/Samosas%2C_snack_food_at_Wikipedia%27s_16th_Birthday_celebration_in_Chittagong_%2801%29.jpg/960px-Samosas%2C_snack_food_at_Wikipedia%27s_16th_Birthday_celebration_in_Chittagong_%2801%29.jpg"
  },
  {
    "category": "Starters & Chaat",
    "categoryDescription": "Small plates, street-food classics and crispy bites to open the table.",
    "name": "Mix Vegetable Pakora",
    "description": "Crispy gram-flour fritters of onion, potato and spinach with mint raita.",
    "price": 320,
    "prepTimeMinutes": 10,
    "allergens": "Gluten",
    "imageUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/cf/Onion_pakora_-_a.jpg/960px-Onion_pakora_-_a.jpg"
  },
  {
    "category": "Starters & Chaat",
    "categoryDescription": "Small plates, street-food classics and crispy bites to open the table.",
    "name": "Dahi Puri Chaat",
    "description": "Crisp puris loaded with potato, sweet yoghurt, tamarind and fine sev.",
    "price": 350,
    "prepTimeMinutes": 7,
    "allergens": "Gluten, Dairy",
    "imageUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a0/Dahi_puri%2C_Doi_phuchka.jpg/960px-Dahi_puri%2C_Doi_phuchka.jpg"
  },
  {
    "category": "Starters & Chaat",
    "categoryDescription": "Small plates, street-food classics and crispy bites to open the table.",
    "name": "Gol Gappay (8 pcs)",
    "description": "Hollow semolina shells with chickpeas and tangy khatta-meetha pani.",
    "price": 300,
    "prepTimeMinutes": 6,
    "allergens": "Gluten",
    "imageUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e9/Pani_Puri1.JPG/960px-Pani_Puri1.JPG"
  },
  {
    "category": "Starters & Chaat",
    "categoryDescription": "Small plates, street-food classics and crispy bites to open the table.",
    "name": "Dahi Bhallay",
    "description": "Soft lentil dumplings in chilled whipped yoghurt with chaat masala.",
    "price": 380,
    "prepTimeMinutes": 6,
    "allergens": "Dairy",
    "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/2/2d/Dahi_bhalla_or_dahi_wada_or_dahi_bada.PNG"
  },
  {
    "category": "Starters & Chaat",
    "categoryDescription": "Small plates, street-food classics and crispy bites to open the table.",
    "name": "Crispy Hot Wings (8 pcs)",
    "description": "Fried chicken wings tossed in house hot sauce, served with ranch dip.",
    "price": 790,
    "prepTimeMinutes": 15,
    "allergens": "Gluten, Dairy",
    "imageUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/51/Buffalo_wings-01.jpg/960px-Buffalo_wings-01.jpg"
  },
  {
    "category": "Starters & Chaat",
    "categoryDescription": "Small plates, street-food classics and crispy bites to open the table.",
    "name": "Classic Hummus",
    "description": "Silky chickpea and tahini dip with olive oil, served with warm pita.",
    "price": 520,
    "prepTimeMinutes": 6,
    "allergens": "Sesame",
    "imageUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/bf/Lebanese_style_hummus.jpg/960px-Lebanese_style_hummus.jpg"
  },
  {
    "category": "Starters & Chaat",
    "categoryDescription": "Small plates, street-food classics and crispy bites to open the table.",
    "name": "Falafel Platter",
    "description": "Crisp chickpea-herb fritters with tahini sauce and pickles.",
    "price": 560,
    "prepTimeMinutes": 10,
    "allergens": "Sesame",
    "imageUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/57/Falafels_2.jpg/960px-Falafels_2.jpg"
  },
  {
    "category": "BBQ & Tandoor",
    "categoryDescription": "Charcoal-grilled and clay-oven specialities, marinated overnight.",
    "name": "Chicken Tikka Boti",
    "description": "Boneless chicken marinated in yoghurt and red chilli, chargrilled on skewers.",
    "price": 890,
    "prepTimeMinutes": 20,
    "allergens": "Dairy",
    "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/b/bd/Tandoorimumbai.jpg"
  },
  {
    "category": "BBQ & Tandoor",
    "categoryDescription": "Charcoal-grilled and clay-oven specialities, marinated overnight.",
    "name": "Beef Seekh Kebab (4 pcs)",
    "description": "Hand-minced beef with onion, coriander and garam masala, grilled over coals.",
    "price": 950,
    "prepTimeMinutes": 18,
    "allergens": "",
    "imageUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0c/Pakistani_Food_Beef_Kabobs.jpg/960px-Pakistani_Food_Beef_Kabobs.jpg"
  },
  {
    "category": "BBQ & Tandoor",
    "categoryDescription": "Charcoal-grilled and clay-oven specialities, marinated overnight.",
    "name": "Tandoori Chicken (Half)",
    "description": "Bone-in chicken in a smoky tandoori marinade, roasted in the clay oven.",
    "price": 1150,
    "prepTimeMinutes": 25,
    "allergens": "Dairy",
    "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/e/e1/Chickentandoori.jpg"
  },
  {
    "category": "BBQ & Tandoor",
    "categoryDescription": "Charcoal-grilled and clay-oven specialities, marinated overnight.",
    "name": "Balochi Chicken Sajji",
    "description": "Whole chicken slow-roasted with sajji masala, served with lemon and raita.",
    "price": 1890,
    "prepTimeMinutes": 35,
    "allergens": "",
    "imageUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/08/Sajji.JPG/960px-Sajji.JPG"
  },
  {
    "category": "BBQ & Tandoor",
    "categoryDescription": "Charcoal-grilled and clay-oven specialities, marinated overnight.",
    "name": "Grilled Beef Steak",
    "description": "Tenderloin steak with mushroom sauce, sauteed vegetables and mash.",
    "price": 2450,
    "prepTimeMinutes": 25,
    "allergens": "Dairy",
    "imageUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f4/Steak_with_shitaki_mushrooms.jpg/960px-Steak_with_shitaki_mushrooms.jpg"
  },
  {
    "category": "Curries & Handi",
    "categoryDescription": "Slow-cooked desi gravies, finished in ghee and fresh spices.",
    "name": "Butter Chicken",
    "description": "Tandoori chicken simmered in a velvety tomato, butter and cream gravy.",
    "price": 1250,
    "prepTimeMinutes": 20,
    "allergens": "Dairy, Nuts",
    "imageUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/41/Butter_Chicken_%26_Butter_Naan_-_Home_-_Chandigarh_-_India_-_0006.jpg/960px-Butter_Chicken_%26_Butter_Naan_-_Home_-_Chandigarh_-_India_-_0006.jpg"
  },
  {
    "category": "Curries & Handi",
    "categoryDescription": "Slow-cooked desi gravies, finished in ghee and fresh spices.",
    "name": "Chicken Tikka Masala",
    "description": "Chargrilled tikka in a rich, spiced masala sauce.",
    "price": 1190,
    "prepTimeMinutes": 20,
    "allergens": "Dairy",
    "imageUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/00/Chicken_tikka_masala_%28cropped%29.jpg/960px-Chicken_tikka_masala_%28cropped%29.jpg"
  },
  {
    "category": "Curries & Handi",
    "categoryDescription": "Slow-cooked desi gravies, finished in ghee and fresh spices.",
    "name": "Mutton Rogan Josh",
    "description": "Tender mutton braised with Kashmiri chilli, yoghurt and whole spices.",
    "price": 1890,
    "prepTimeMinutes": 30,
    "allergens": "Dairy",
    "imageUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/67/Rogan_Josh_Kashmiri.jpg/960px-Rogan_Josh_Kashmiri.jpg"
  },
  {
    "category": "Curries & Handi",
    "categoryDescription": "Slow-cooked desi gravies, finished in ghee and fresh spices.",
    "name": "Nalli Nihari",
    "description": "Overnight slow-cooked beef shank stew with bone marrow, ginger and lemon.",
    "price": 1650,
    "prepTimeMinutes": 25,
    "allergens": "Gluten",
    "imageUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4b/Nalli_Nihari_India.jpg/960px-Nalli_Nihari_India.jpg"
  },
  {
    "category": "Curries & Handi",
    "categoryDescription": "Slow-cooked desi gravies, finished in ghee and fresh spices.",
    "name": "Aloo Gosht",
    "description": "Home-style mutton and potato curry in a light shorba.",
    "price": 1350,
    "prepTimeMinutes": 25,
    "allergens": "",
    "imageUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/83/Aaloo_Gosht_%28cropped%29.JPG/960px-Aaloo_Gosht_%28cropped%29.JPG"
  },
  {
    "category": "Curries & Handi",
    "categoryDescription": "Slow-cooked desi gravies, finished in ghee and fresh spices.",
    "name": "Daal Makhani",
    "description": "Black lentils simmered overnight with butter and cream.",
    "price": 690,
    "prepTimeMinutes": 15,
    "allergens": "Dairy",
    "imageUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/69/Punjabi_style_Dal_Makhani.jpg/960px-Punjabi_style_Dal_Makhani.jpg"
  },
  {
    "category": "Curries & Handi",
    "categoryDescription": "Slow-cooked desi gravies, finished in ghee and fresh spices.",
    "name": "Lahori Chana Masala",
    "description": "Chickpeas in a tangy onion-tomato masala with fresh coriander.",
    "price": 590,
    "prepTimeMinutes": 12,
    "allergens": "",
    "imageUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8e/Chana_masala.jpg/960px-Chana_masala.jpg"
  },
  {
    "category": "Curries & Handi",
    "categoryDescription": "Slow-cooked desi gravies, finished in ghee and fresh spices.",
    "name": "Palak Paneer",
    "description": "Cottage cheese cubes in a smooth spiced spinach gravy.",
    "price": 790,
    "prepTimeMinutes": 15,
    "allergens": "Dairy",
    "imageUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b7/Palakpaneer_Rayagada_Odisha_0009.jpg/960px-Palakpaneer_Rayagada_Odisha_0009.jpg"
  },
  {
    "category": "Curries & Handi",
    "categoryDescription": "Slow-cooked desi gravies, finished in ghee and fresh spices.",
    "name": "Sarson ka Saag",
    "description": "Slow-cooked mustard greens topped with white butter.",
    "price": 720,
    "prepTimeMinutes": 15,
    "allergens": "Dairy",
    "imageUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b2/Punjabi_Sarsoon_Ka_Saag.JPG/960px-Punjabi_Sarsoon_Ka_Saag.JPG"
  },
  {
    "category": "Curries & Handi",
    "categoryDescription": "Slow-cooked desi gravies, finished in ghee and fresh spices.",
    "name": "Chicken Manchurian",
    "description": "Crispy chicken in a sweet-and-sour Indo-Chinese sauce with peppers.",
    "price": 990,
    "prepTimeMinutes": 18,
    "allergens": "Soy, Gluten",
    "imageUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/bb/Chicken_Manchurian_%28Hyderabad_Style%29_%2811960049916%29.jpg/960px-Chicken_Manchurian_%28Hyderabad_Style%29_%2811960049916%29.jpg"
  },
  {
    "category": "Rice & Noodles",
    "categoryDescription": "Fragrant basmati on dum, and wok-tossed noodles.",
    "name": "Chicken Dum Biryani",
    "description": "Aromatic basmati layered with spiced chicken, served with raita and salad.",
    "price": 690,
    "prepTimeMinutes": 20,
    "allergens": "Dairy",
    "imageUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5a/%22Hyderabadi_Dum_Biryani%22.jpg/960px-%22Hyderabadi_Dum_Biryani%22.jpg"
  },
  {
    "category": "Rice & Noodles",
    "categoryDescription": "Fragrant basmati on dum, and wok-tossed noodles.",
    "name": "Kabuli Pulao",
    "description": "Afghan-style rice with tender lamb, caramelised carrots and raisins.",
    "price": 1450,
    "prepTimeMinutes": 25,
    "allergens": "Nuts",
    "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/d/dd/Afghan_Palo.jpg"
  },
  {
    "category": "Rice & Noodles",
    "categoryDescription": "Fragrant basmati on dum, and wok-tossed noodles.",
    "name": "Chicken Chow Mein",
    "description": "Wok-tossed noodles with chicken, cabbage, carrots and spring onion.",
    "price": 850,
    "prepTimeMinutes": 15,
    "allergens": "Gluten, Soy, Egg",
    "imageUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a6/Homemade_Chow_mein_with_shrimps_and_meat_with_a_choy_and_Choung.jpg/960px-Homemade_Chow_mein_with_shrimps_and_meat_with_a_choy_and_Choung.jpg"
  },
  {
    "category": "Breads",
    "categoryDescription": "Baked to order in the tandoor.",
    "name": "Garlic Naan",
    "description": "Soft tandoori naan brushed with garlic butter and coriander.",
    "price": 120,
    "prepTimeMinutes": 6,
    "allergens": "Gluten, Dairy",
    "imageUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4e/Annapurna_Naan.jpg/960px-Annapurna_Naan.jpg"
  },
  {
    "category": "Breads",
    "categoryDescription": "Baked to order in the tandoor.",
    "name": "Amritsari Kulcha",
    "description": "Stuffed kulcha baked crisp in the tandoor, topped with coriander.",
    "price": 150,
    "prepTimeMinutes": 7,
    "allergens": "Gluten, Dairy",
    "imageUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/dd/Chole_Kulcha_Meal_-_Order_Food_Online_in_Mumbai_%2831013272937%29.jpg/960px-Chole_Kulcha_Meal_-_Order_Food_Online_in_Mumbai_%2831013272937%29.jpg"
  },
  {
    "category": "Breads",
    "categoryDescription": "Baked to order in the tandoor.",
    "name": "Lachha Paratha",
    "description": "Flaky, layered whole-wheat paratha cooked in ghee.",
    "price": 110,
    "prepTimeMinutes": 6,
    "allergens": "Gluten, Dairy",
    "imageUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1e/Triangle_paratha_%28cropped%29.JPG/960px-Triangle_paratha_%28cropped%29.JPG"
  },
  {
    "category": "Breads",
    "categoryDescription": "Baked to order in the tandoor.",
    "name": "Puri (2 pcs)",
    "description": "Light, puffed deep-fried bread.",
    "price": 90,
    "prepTimeMinutes": 5,
    "allergens": "Gluten",
    "imageUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/50/Fluffy_Poori_%28cropped%29.JPG/960px-Fluffy_Poori_%28cropped%29.JPG"
  },
  {
    "category": "Breads",
    "categoryDescription": "Baked to order in the tandoor.",
    "name": "Sheermal",
    "description": "Mildly sweet saffron-milk bread, a perfect partner for nihari.",
    "price": 140,
    "prepTimeMinutes": 6,
    "allergens": "Gluten, Dairy",
    "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/4/44/Sheermal_bread_made_in_Iran.jpg"
  },
  {
    "category": "Burgers, Pizza & Continental",
    "categoryDescription": "Comfort favourites from around the world.",
    "name": "Classic Beef Cheeseburger",
    "description": "Flame-grilled beef patty, cheddar, lettuce and house sauce in a sesame bun.",
    "price": 890,
    "prepTimeMinutes": 15,
    "allergens": "Gluten, Dairy, Sesame",
    "imageUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4d/Cheeseburger.jpg/960px-Cheeseburger.jpg"
  },
  {
    "category": "Burgers, Pizza & Continental",
    "categoryDescription": "Comfort favourites from around the world.",
    "name": "Chicken Club Sandwich",
    "description": "Toasted triple-decker with grilled chicken, cheese and crisp lettuce.",
    "price": 790,
    "prepTimeMinutes": 12,
    "allergens": "Gluten, Egg, Dairy",
    "imageUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/51/Club_sandwich_at_Caf%C3%A9_Picnic.jpg/960px-Club_sandwich_at_Caf%C3%A9_Picnic.jpg"
  },
  {
    "category": "Burgers, Pizza & Continental",
    "categoryDescription": "Comfort favourites from around the world.",
    "name": "Margherita Pizza",
    "description": "Wood-fired base, tomato, mozzarella and fresh basil.",
    "price": 1290,
    "prepTimeMinutes": 18,
    "allergens": "Gluten, Dairy",
    "imageUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/57/Neapolitan_pizza_at_Trappica_%2848701940197%29.jpg/960px-Neapolitan_pizza_at_Trappica_%2848701940197%29.jpg"
  },
  {
    "category": "Burgers, Pizza & Continental",
    "categoryDescription": "Comfort favourites from around the world.",
    "name": "Fish & Chips",
    "description": "Crispy battered fish fillet with fries and tartar sauce.",
    "price": 1390,
    "prepTimeMinutes": 18,
    "allergens": "Fish, Gluten",
    "imageUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/ff/Fish_and_chips_blackpool.jpg/960px-Fish_and_chips_blackpool.jpg"
  },
  {
    "category": "Burgers, Pizza & Continental",
    "categoryDescription": "Comfort favourites from around the world.",
    "name": "Masala Fries",
    "description": "Crisp golden fries dusted with house masala.",
    "price": 350,
    "prepTimeMinutes": 8,
    "allergens": "",
    "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/8/83/French_Fries.JPG"
  },
  {
    "category": "Soups & Salads",
    "categoryDescription": "Light, fresh and made to order.",
    "name": "Hot & Sour Soup",
    "description": "Peppery chicken broth with vegetables, egg ribbons and a splash of vinegar.",
    "price": 450,
    "prepTimeMinutes": 8,
    "allergens": "Soy, Egg",
    "imageUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3a/Ping_SJ_hot_%26_sour_soup.JPG/960px-Ping_SJ_hot_%26_sour_soup.JPG"
  },
  {
    "category": "Soups & Salads",
    "categoryDescription": "Light, fresh and made to order.",
    "name": "Lemon Lentil Soup",
    "description": "Smooth red-lentil soup with cumin, lemon and crispy onions.",
    "price": 390,
    "prepTimeMinutes": 8,
    "allergens": "",
    "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/6/61/EgFoodLentilSoup.jpg"
  },
  {
    "category": "Soups & Salads",
    "categoryDescription": "Light, fresh and made to order.",
    "name": "Chicken Caesar Salad",
    "description": "Crisp romaine, parmesan and garlic croutons in Caesar dressing.",
    "price": 790,
    "prepTimeMinutes": 10,
    "allergens": "Dairy, Egg, Gluten",
    "imageUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/23/Caesar_salad_%282%29.jpg/960px-Caesar_salad_%282%29.jpg"
  },
  {
    "category": "Soups & Salads",
    "categoryDescription": "Light, fresh and made to order.",
    "name": "Greek Salad",
    "description": "Tomato, cucumber, olives and feta with oregano and olive oil.",
    "price": 690,
    "prepTimeMinutes": 8,
    "allergens": "Dairy",
    "imageUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f2/Greece_Food_Horiatiki.JPG/960px-Greece_Food_Horiatiki.JPG"
  },
  {
    "category": "Desserts",
    "categoryDescription": "Traditional mithai and classic sweet endings.",
    "name": "Gulab Jamun (2 pcs)",
    "description": "Warm milk-solid dumplings soaked in rose-cardamom syrup.",
    "price": 290,
    "prepTimeMinutes": 4,
    "allergens": "Dairy, Gluten",
    "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/c/c1/Gulab-jamun-wallpaper-1.jpg"
  },
  {
    "category": "Desserts",
    "categoryDescription": "Traditional mithai and classic sweet endings.",
    "name": "Ras Malai",
    "description": "Soft cheese patties in chilled saffron milk with pistachio.",
    "price": 350,
    "prepTimeMinutes": 4,
    "allergens": "Dairy, Nuts",
    "imageUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ae/Ras_Malai_2.JPG/960px-Ras_Malai_2.JPG"
  },
  {
    "category": "Desserts",
    "categoryDescription": "Traditional mithai and classic sweet endings.",
    "name": "Shahi Kheer",
    "description": "Creamy slow-cooked rice pudding with almonds.",
    "price": 320,
    "prepTimeMinutes": 4,
    "allergens": "Dairy, Nuts",
    "imageUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/46/Kheer.jpg/960px-Kheer.jpg"
  },
  {
    "category": "Desserts",
    "categoryDescription": "Traditional mithai and classic sweet endings.",
    "name": "Matka Firni",
    "description": "Ground-rice pudding set in a clay pot, topped with pistachio.",
    "price": 300,
    "prepTimeMinutes": 4,
    "allergens": "Dairy, Nuts",
    "imageUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7a/Firni_Or_Phirni.jpg/960px-Firni_Or_Phirni.jpg"
  },
  {
    "category": "Desserts",
    "categoryDescription": "Traditional mithai and classic sweet endings.",
    "name": "Gajar ka Halwa",
    "description": "Winter carrot pudding cooked in milk and ghee with cashews.",
    "price": 380,
    "prepTimeMinutes": 5,
    "allergens": "Dairy, Nuts",
    "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/c/cb/Cuisine_%28268%29_44.jpg"
  },
  {
    "category": "Desserts",
    "categoryDescription": "Traditional mithai and classic sweet endings.",
    "name": "Garam Jalebi",
    "description": "Crisp saffron spirals, served hot and syrupy.",
    "price": 250,
    "prepTimeMinutes": 5,
    "allergens": "Gluten",
    "imageUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/96/Basavanagudi_Kadalekai_Parishe_%282025%29_Bangalore_%2886%29.jpg/960px-Basavanagudi_Kadalekai_Parishe_%282025%29_Bangalore_%2886%29.jpg"
  },
  {
    "category": "Desserts",
    "categoryDescription": "Traditional mithai and classic sweet endings.",
    "name": "Matka Kulfi",
    "description": "Traditional dense ice cream with pistachio, served in a clay pot.",
    "price": 340,
    "prepTimeMinutes": 3,
    "allergens": "Dairy, Nuts",
    "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/8/8a/Matka_kulfi.jpg"
  },
  {
    "category": "Desserts",
    "categoryDescription": "Traditional mithai and classic sweet endings.",
    "name": "Kunafa",
    "description": "Crisp kataifi pastry over molten cheese, with syrup and pistachio.",
    "price": 650,
    "prepTimeMinutes": 10,
    "allergens": "Dairy, Gluten, Nuts",
    "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/c/c8/K%C3%BCnefe.jpg"
  },
  {
    "category": "Desserts",
    "categoryDescription": "Traditional mithai and classic sweet endings.",
    "name": "New York Cheesecake",
    "description": "Baked vanilla cheesecake with fresh berries.",
    "price": 690,
    "prepTimeMinutes": 4,
    "allergens": "Dairy, Gluten, Egg",
    "imageUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ea/Baked_cheesecake_with_raspberries_and_blueberries.jpg/960px-Baked_cheesecake_with_raspberries_and_blueberries.jpg"
  },
  {
    "category": "Desserts",
    "categoryDescription": "Traditional mithai and classic sweet endings.",
    "name": "Chocolate Fudge Brownie",
    "description": "Warm, gooey brownie with dark chocolate chunks.",
    "price": 520,
    "prepTimeMinutes": 5,
    "allergens": "Dairy, Gluten, Egg",
    "imageUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/68/Chocolatebrownie.JPG/960px-Chocolatebrownie.JPG"
  },
  {
    "category": "Desserts",
    "categoryDescription": "Traditional mithai and classic sweet endings.",
    "name": "Tiramisu",
    "description": "Espresso-soaked sponge layered with mascarpone and cocoa.",
    "price": 720,
    "prepTimeMinutes": 4,
    "allergens": "Dairy, Gluten, Egg",
    "imageUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/58/Tiramisu_-_Raffaele_Diomede.jpg/960px-Tiramisu_-_Raffaele_Diomede.jpg"
  },
  {
    "category": "Desserts",
    "categoryDescription": "Traditional mithai and classic sweet endings.",
    "name": "Strawberry Sundae",
    "description": "Vanilla ice cream with fresh strawberries and strawberry sauce.",
    "price": 490,
    "prepTimeMinutes": 5,
    "allergens": "Dairy",
    "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/a/ae/StrawberrySundae.jpg"
  },
  {
    "category": "Beverages",
    "categoryDescription": "Hot chai, fresh juices, shakes and coolers.",
    "name": "Karak Chai",
    "description": "Strong, slow-brewed doodh patti with cardamom.",
    "price": 180,
    "prepTimeMinutes": 5,
    "allergens": "Dairy",
    "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/8/89/Chai_In_Sakora.jpg"
  },
  {
    "category": "Beverages",
    "categoryDescription": "Hot chai, fresh juices, shakes and coolers.",
    "name": "Kashmiri Pink Chai",
    "description": "Creamy Kashmiri tea, slow-brewed and finished with crushed nuts.",
    "price": 280,
    "prepTimeMinutes": 6,
    "allergens": "Dairy, Nuts",
    "imageUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4e/The_Great_Kashmiri_Salt_tea.png/960px-The_Great_Kashmiri_Salt_tea.png"
  },
  {
    "category": "Beverages",
    "categoryDescription": "Hot chai, fresh juices, shakes and coolers.",
    "name": "Cappuccino",
    "description": "Double espresso with steamed milk and velvety foam.",
    "price": 450,
    "prepTimeMinutes": 5,
    "allergens": "Dairy",
    "imageUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/70/Cappuccino_in_original.jpg/960px-Cappuccino_in_original.jpg"
  },
  {
    "category": "Beverages",
    "categoryDescription": "Hot chai, fresh juices, shakes and coolers.",
    "name": "Affogato",
    "description": "Vanilla ice cream drowned in a shot of hot espresso.",
    "price": 520,
    "prepTimeMinutes": 4,
    "allergens": "Dairy",
    "imageUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ac/Affogato_al_Caffe.jpg/960px-Affogato_al_Caffe.jpg"
  },
  {
    "category": "Beverages",
    "categoryDescription": "Hot chai, fresh juices, shakes and coolers.",
    "name": "Sweet Punjabi Lassi",
    "description": "Thick churned yoghurt drink, served chilled.",
    "price": 320,
    "prepTimeMinutes": 4,
    "allergens": "Dairy",
    "imageUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f1/Salt_lassi.jpg/960px-Salt_lassi.jpg"
  },
  {
    "category": "Beverages",
    "categoryDescription": "Hot chai, fresh juices, shakes and coolers.",
    "name": "Mint Margarita",
    "description": "Frozen fresh mint and lemon cooler.",
    "price": 350,
    "prepTimeMinutes": 4,
    "allergens": "",
    "imageUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b7/Lemon_%26_Mint.jpg/960px-Lemon_%26_Mint.jpg"
  },
  {
    "category": "Beverages",
    "categoryDescription": "Hot chai, fresh juices, shakes and coolers.",
    "name": "Fresh Orange Juice",
    "description": "Squeezed to order, no added sugar.",
    "price": 420,
    "prepTimeMinutes": 5,
    "allergens": "",
    "imageUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/05/Orangejuice.jpg/960px-Orangejuice.jpg"
  },
  {
    "category": "Beverages",
    "categoryDescription": "Hot chai, fresh juices, shakes and coolers.",
    "name": "Strawberry Milkshake",
    "description": "Thick shake blended with fresh strawberries and ice cream.",
    "price": 490,
    "prepTimeMinutes": 5,
    "allergens": "Dairy",
    "imageUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/68/Strawberry_milk_shake_%28cropped%29.jpg/960px-Strawberry_milk_shake_%28cropped%29.jpg"
  },
  {
    "category": "Beverages",
    "categoryDescription": "Hot chai, fresh juices, shakes and coolers.",
    "name": "Ganne ka Ras",
    "description": "Fresh-pressed sugarcane juice with lemon and ginger.",
    "price": 250,
    "prepTimeMinutes": 4,
    "allergens": "",
    "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/6/63/Sugarcanejuice.jpg"
  },
  {
    "category": "Beverages",
    "categoryDescription": "Hot chai, fresh juices, shakes and coolers.",
    "name": "Virgin Mojito",
    "description": "Muddled mint and lime topped with soda over crushed ice.",
    "price": 390,
    "prepTimeMinutes": 4,
    "allergens": "",
    "imageUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/54/15-09-26-RalfR-WLC-0072.jpg/960px-15-09-26-RalfR-WLC-0072.jpg"
  }
];
